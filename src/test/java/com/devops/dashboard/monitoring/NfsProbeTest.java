package com.devops.dashboard.monitoring;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;

class NfsProbeTest {
    @TempDir Path temp;

    @Test void distinguishesExpectedNfsMountFromLocalDirectory() throws Exception {
        Path mount = Files.createDirectory(temp.resolve("shared"));
        Path info = temp.resolve("mountinfo");
        Files.writeString(info, "36 25 0:32 / " + mount + " rw - nfs4 192.168.56.26:/srv/nfs/shared rw\n");
        NfsProbe mounted = new NfsProbe(mount, "192.168.56.26", "/srv/nfs/shared", false, info);
        assertEquals(HealthStatus.UP, mounted.check().status());

        Files.writeString(info, "36 25 0:32 / " + mount + " rw - ext4 /dev/disk1 rw\n");
        assertEquals(HealthStatus.DOWN, mounted.check().status());
    }

    @Test void reportsUnsupportedPlatformAndSafeWriteCapability() throws Exception {
        Path mount = Files.createDirectory(temp.resolve("writable"));
        NfsProbe unsupported = new NfsProbe(mount, "server", "/export", false, temp.resolve("missing"));
        assertEquals(HealthStatus.UNKNOWN, unsupported.check().status());

        Path info = temp.resolve("mountinfo");
        Files.writeString(info, "36 25 0:32 / " + mount + " rw - nfs server:/export rw\n");
        assertEquals(HealthStatus.UP, new NfsProbe(mount, "server", "/export", true, info).check().status());
    }
}
