package com.devops.dashboard.monitoring;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.time.Clock;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class InfrastructureMonitoringServiceTest {
    @Test void cachesSnapshotsAndIsolatesPartialFailures() {
        AtomicInteger calls = new AtomicInteger();
        InfrastructureProbe healthy = probe("one", () -> {
            calls.incrementAndGet();
            return health("one", HealthStatus.UP);
        });
        InfrastructureProbe failed = probe("two", () -> { throw new IllegalStateException("connection failed"); });
        try (var service = new InfrastructureMonitoringService(List.of(healthy, failed), true,
                Duration.ofMinutes(1), Duration.ofMillis(200))) {
            InfrastructureHealthSnapshot first = service.getSnapshot();
            InfrastructureHealthSnapshot second = service.getSnapshot();
            assertSame(first, second);
            assertEquals(1, calls.get());
            assertEquals(HealthStatus.UP, first.services().get(0).status());
            assertEquals(HealthStatus.DOWN, first.services().get(1).status());
        }
    }

    @Test void boundsSlowProbeAndShutsDownCleanly() {
        InfrastructureProbe slow = probe("slow", () -> {
            Thread.sleep(5_000);
            return health("slow", HealthStatus.UP);
        });
        long start = System.nanoTime();
        InfrastructureMonitoringService service = new InfrastructureMonitoringService(List.of(slow), true,
                Duration.ofSeconds(5), Duration.ofMillis(50));
        assertEquals(HealthStatus.DOWN, service.getSnapshot().services().getFirst().status());
        assertTrue(Duration.ofNanos(System.nanoTime() - start).toMillis() < 1000);
        service.close();
    }

    @Test void disabledMonitoringIsUnknownNotHealthy() {
        try (var service = new InfrastructureMonitoringService(List.of(probe("one", () -> health("one", HealthStatus.UP))),
                false, Duration.ofSeconds(5), Duration.ofMillis(50))) {
            InfrastructureHealthSnapshot snapshot = service.getSnapshot();
            assertFalse(snapshot.monitoringEnabled());
            assertEquals(HealthStatus.UNKNOWN, snapshot.services().getFirst().status());
        }
    }

    @Test void marksOldSnapshotsStaleWithoutInventingNewMeasurements() {
        MutableClock clock = new MutableClock(Instant.parse("2026-10-22T10:00:00Z"));
        try (var service = new InfrastructureMonitoringService(List.of(), true,
                Duration.ofSeconds(15), Duration.ofMillis(50), clock)) {
            var old = new InfrastructureHealthSnapshot(clock.instant(), true, false,
                    List.of(health("one", HealthStatus.UP)));
            clock.now = clock.now.plusSeconds(31);
            InfrastructureHealthSnapshot stale = service.markStaleIfNeeded(old);
            assertTrue(stale.stale());
            assertEquals(HealthStatus.STALE, stale.services().getFirst().status());
        }
    }

    private InfrastructureProbe probe(String id, java.util.concurrent.Callable<ServiceHealth> action) {
        return new FunctionalProbe(id, id, "TEST", action);
    }

    private ServiceHealth health(String id, HealthStatus status) {
        return new ServiceHealth(id, id, status, "TEST", 1L, Instant.now(), null, null, Map.of());
    }

    private static final class MutableClock extends Clock {
        private Instant now;
        private MutableClock(Instant now) { this.now = now; }
        @Override public ZoneId getZone() { return ZoneId.of("UTC"); }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }
}
