package com.devops.dashboard.monitoring;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class NfsProbe implements InfrastructureProbe {
    private final Path mountPath;
    private final String expectedServer;
    private final String expectedExport;
    private final boolean writeProbeEnabled;
    private final Path mountInfo;

    public NfsProbe(String mountPath, String expectedServer, String expectedExport, boolean writeProbeEnabled) {
        this(Path.of(mountPath), expectedServer, expectedExport, writeProbeEnabled, Path.of("/proc/self/mountinfo"));
    }

    NfsProbe(Path mountPath, String expectedServer, String expectedExport, boolean writeProbeEnabled, Path mountInfo) {
        this.mountPath = mountPath.toAbsolutePath().normalize();
        this.expectedServer = expectedServer;
        this.expectedExport = expectedExport;
        this.writeProbeEnabled = writeProbeEnabled;
        this.mountInfo = mountInfo;
    }

    public String id() { return "nfs01"; }
    public String name() { return "NFSv4"; }
    public String monitoringType() { return writeProbeEnabled ? "NFS_MOUNT_READ_WRITE" : "NFS_MOUNT_READ_ONLY"; }

    @Override
    public ServiceHealth check() throws Exception {
        long start = System.nanoTime();
        Instant checkedAt = Instant.now();
        if (!Files.isReadable(mountInfo)) {
            return result(HealthStatus.UNKNOWN, start, checkedAt, "Mount inspection is unsupported on this platform",
                    Map.of("mountPath", mountPath.toString(), "platformSupported", false));
        }
        Mount match = findMount(Files.readAllLines(mountInfo));
        if (match == null) {
            return result(HealthStatus.DOWN, start, checkedAt, "Configured path is not the expected NFS mount",
                    Map.of("mountPath", mountPath.toString(), "mounted", false));
        }
        boolean readable = Files.isDirectory(mountPath) && Files.isReadable(mountPath);
        if (!readable) {
            return result(HealthStatus.DOWN, start, checkedAt, "NFS mount is not readable",
                    Map.of("mounted", true, "readable", false, "source", match.source));
        }
        Map<String, Object> details = new java.util.LinkedHashMap<>();
        details.put("mounted", true);
        details.put("readable", true);
        details.put("filesystemType", match.fsType);
        details.put("source", match.source);
        details.put("writeProbeEnabled", writeProbeEnabled);
        if (writeProbeEnabled) {
            boolean writable = writeReadDelete();
            details.put("writable", writable);
            if (!writable) return result(HealthStatus.DEGRADED, start, checkedAt, "NFS write/read/delete probe failed", details);
        }
        return result(HealthStatus.UP, start, checkedAt, null, details);
    }

    private Mount findMount(List<String> lines) {
        String expectedMount = mountPath.toString().replace(" ", "\\040");
        String expectedSource = expectedServer + ":" + expectedExport;
        for (String line : lines) {
            String[] halves = line.split(" - ", 2);
            if (halves.length != 2) continue;
            String[] before = halves[0].split(" ");
            String[] after = halves[1].split(" ");
            if (before.length < 5 || after.length < 2) continue;
            boolean nfs = after[0].equals("nfs") || after[0].equals("nfs4");
            if (nfs && before[4].equals(expectedMount) && after[1].equals(expectedSource)) return new Mount(after[0], after[1]);
        }
        return null;
    }

    private boolean writeReadDelete() {
        Path probe = mountPath.resolve(".devops-dashboard-health-" + UUID.randomUUID());
        try {
            byte[] marker = UUID.randomUUID().toString().getBytes(StandardCharsets.UTF_8);
            Files.write(probe, marker, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);
            return java.util.Arrays.equals(marker, Files.readAllBytes(probe));
        } catch (IOException | SecurityException e) {
            return false;
        } finally {
            try { Files.deleteIfExists(probe); } catch (IOException ignored) { }
        }
    }

    private ServiceHealth result(HealthStatus status, long start, Instant checkedAt, String error, Map<String, Object> details) {
        return new ServiceHealth(id(), name(), status, monitoringType(),
                (System.nanoTime() - start) / 1_000_000, checkedAt, null, error, details);
    }

    private record Mount(String fsType, String source) { }
}
