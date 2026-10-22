package com.devops.dashboard.monitoring;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;

/** A bounded, request-triggered snapshot cache. No per-browser or unbounded background work. */
public final class InfrastructureMonitoringService implements AutoCloseable {
    private static final Logger log = LoggerFactory.getLogger(InfrastructureMonitoringService.class);
    private final List<InfrastructureProbe> probes;
    private final boolean enabled;
    private final Duration interval;
    private final Duration timeout;
    private final Clock clock;
    private final ExecutorService executor;
    private final List<java.util.concurrent.atomic.AtomicBoolean> probeRunning;
    private final AtomicReference<InfrastructureHealthSnapshot> snapshot = new AtomicReference<>();
    private final Object refreshLock = new Object();

    public InfrastructureMonitoringService(List<InfrastructureProbe> probes, boolean enabled,
                                           Duration interval, Duration timeout) {
        this(probes, enabled, interval, timeout, Clock.systemUTC());
    }

    InfrastructureMonitoringService(List<InfrastructureProbe> probes, boolean enabled,
                                    Duration interval, Duration timeout, Clock clock) {
        this.probes = List.copyOf(probes);
        this.enabled = enabled;
        this.interval = interval;
        this.timeout = timeout;
        this.clock = clock;
        this.probeRunning = probes.stream().map(ignored -> new java.util.concurrent.atomic.AtomicBoolean()).toList();
        int workers = Math.max(1, Math.min(4, probes.size()));
        this.executor = new ThreadPoolExecutor(workers, workers, 30, TimeUnit.SECONDS,
                new ArrayBlockingQueue<>(Math.max(1, probes.size())), runnable -> {
                    Thread thread = new Thread(runnable, "infra-monitor");
                    thread.setDaemon(true);
                    return thread;
                }, new ThreadPoolExecutor.AbortPolicy());
    }

    public InfrastructureHealthSnapshot getSnapshot() {
        if (!enabled) return disabledSnapshot();
        InfrastructureHealthSnapshot current = snapshot.get();
        Instant now = clock.instant();
        if (current != null && Duration.between(current.checkedAt(), now).compareTo(interval) < 0) {
            return current;
        }
        synchronized (refreshLock) {
            current = snapshot.get();
            now = clock.instant();
            if (current != null && Duration.between(current.checkedAt(), now).compareTo(interval) < 0) {
                return current;
            }
            return refresh(current);
        }
    }

    private InfrastructureHealthSnapshot refresh(InfrastructureHealthSnapshot previous) {
        Map<String, ServiceHealth> prior = previous == null ? Map.of() : previous.services().stream()
                .collect(java.util.stream.Collectors.toMap(ServiceHealth::id, service -> service));
        List<Future<ServiceHealth>> futures = new ArrayList<>();
        for (int index = 0; index < probes.size(); index++) {
            InfrastructureProbe probe = probes.get(index);
            var running = probeRunning.get(index);
            if (!running.compareAndSet(false, true)) {
                futures.add(CompletableFuture.completedFuture(failure(probe, "Previous probe is still running")));
                continue;
            }
            try {
                futures.add(executor.submit(() -> {
                    try { return probe.check(); }
                    finally { running.set(false); }
                }));
            } catch (RejectedExecutionException e) {
                running.set(false);
                futures.add(CompletableFuture.completedFuture(failure(probe, "Monitoring capacity is exhausted")));
            }
        }

        List<ServiceHealth> results = new ArrayList<>();
        long deadline = System.nanoTime() + timeout.toNanos();
        for (int index = 0; index < probes.size(); index++) {
            InfrastructureProbe probe = probes.get(index);
            ServiceHealth result;
            try {
                long remaining = Math.max(0, deadline - System.nanoTime());
                result = futures.get(index).get(remaining, TimeUnit.NANOSECONDS);
            } catch (TimeoutException e) {
                futures.get(index).cancel(true);
                result = failure(probe, "Probe timed out after " + timeout.toMillis() + "ms");
            } catch (Exception e) {
                result = failure(probe, safeMessage(e));
            }
            ServiceHealth old = prior.get(probe.id());
            results.add(result.withLastSuccessfulAt(old == null ? null : old.lastSuccessfulAt()));
        }
        futures.stream().filter(future -> !future.isDone()).forEach(future -> future.cancel(true));
        InfrastructureHealthSnapshot updated = new InfrastructureHealthSnapshot(clock.instant(), true, false, results);
        snapshot.set(updated);
        return updated;
    }

    private ServiceHealth failure(InfrastructureProbe probe, String message) {
        log.warn("Infrastructure probe failed: service={}, reason={}", probe.id(), message);
        return new ServiceHealth(probe.id(), probe.name(), HealthStatus.DOWN, probe.monitoringType(),
                null, clock.instant(), null, message, Map.of());
    }

    private String safeMessage(Throwable throwable) {
        Throwable cause = throwable instanceof ExecutionException && throwable.getCause() != null
                ? throwable.getCause() : throwable;
        String message = cause.getMessage();
        if (message == null || message.isBlank()) return cause.getClass().getSimpleName();
        return message.replaceAll("(?i)(password|authorization|credential|token)=[^\\s,]+", "$1=***");
    }

    private InfrastructureHealthSnapshot disabledSnapshot() {
        List<ServiceHealth> services = probes.stream()
                .map(probe -> ServiceHealth.unknown(probe.id(), probe.name(), probe.monitoringType(),
                        "Infrastructure monitoring is disabled"))
                .toList();
        return new InfrastructureHealthSnapshot(clock.instant(), false, false, services);
    }

    public InfrastructureHealthSnapshot markStaleIfNeeded(InfrastructureHealthSnapshot value) {
        if (Duration.between(value.checkedAt(), clock.instant()).compareTo(interval.multipliedBy(2)) <= 0) return value;
        return new InfrastructureHealthSnapshot(value.checkedAt(), value.monitoringEnabled(), true,
                value.services().stream().map(ServiceHealth::stale).toList());
    }

    @Override
    public void close() {
        executor.shutdownNow();
        try {
            if (!executor.awaitTermination(2, TimeUnit.SECONDS)) log.warn("Monitoring executor did not stop promptly");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
