package com.devops.dashboard.service;

import com.devops.dashboard.cache.CacheService;
import com.devops.dashboard.cache.CacheService.LookupResult;
import com.devops.dashboard.cache.CacheService.LookupStatus;
import com.devops.dashboard.dto.CacheDemoResponse;
import com.devops.dashboard.model.DemoRecord;
import com.devops.dashboard.repository.RecordRepository;
import com.devops.dashboard.util.JsonUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CacheDemoServiceTest {

    @Mock
    private RecordRepository recordRepository;

    @Mock
    private CacheService cacheService;

    private CacheDemoService cacheDemoService;

    private final List<DemoRecord> sampleRecords = List.of(
            new DemoRecord(1L, "Record 1", "Description 1", Instant.now()),
            new DemoRecord(2L, "Record 2", "Description 2", Instant.now())
    );

    @BeforeEach
    void setUp() {
        cacheDemoService = new CacheDemoService(recordRepository, cacheService);
    }

    @Test
    void fetchWithCacheAside_cacheHit_returnsFromMemcached() throws Exception {
        String cachedJson = JsonUtil.toJson(sampleRecords);
        when(cacheService.lookup("demo_records"))
                .thenReturn(new LookupResult(LookupStatus.HIT, cachedJson));
        when(cacheService.getTtlSeconds()).thenReturn(60);

        CacheDemoResponse response = cacheDemoService.fetchWithCacheAside();

        assertEquals("MEMCACHED", response.getSource());
        assertEquals("HIT", response.getCacheStatus());
        assertNotNull(response.getData());
        verify(recordRepository, never()).findAll();
    }

    @Test
    void fetchWithCacheAside_cacheMiss_fetchesFromMySQL() throws Exception {
        when(cacheService.lookup("demo_records"))
                .thenReturn(new LookupResult(LookupStatus.MISS, null));
        when(recordRepository.findAll()).thenReturn(sampleRecords);
        when(cacheService.set(eq("demo_records"), anyString())).thenReturn(true);
        when(cacheService.getTtlSeconds()).thenReturn(60);

        CacheDemoResponse response = cacheDemoService.fetchWithCacheAside();

        assertEquals("MYSQL", response.getSource());
        assertEquals("MISS", response.getCacheStatus());
        assertNotNull(response.getData());
        verify(recordRepository).findAll();
        verify(cacheService).set(eq("demo_records"), anyString());
    }

    @Test
    void fetchWithCacheAside_unavailableCache_fallsBackToMySQLWithoutCallingItAMiss() throws Exception {
        when(cacheService.lookup("demo_records"))
                .thenReturn(new LookupResult(LookupStatus.UNAVAILABLE, null));
        when(recordRepository.findAll()).thenReturn(sampleRecords);
        when(cacheService.getTtlSeconds()).thenReturn(60);

        CacheDemoResponse response = cacheDemoService.fetchWithCacheAside();

        assertEquals("MYSQL", response.getSource());
        assertEquals("UNAVAILABLE", response.getCacheStatus());
        assertEquals("SKIPPED", response.getCacheWriteStatus());
        assertEquals(sampleRecords, response.getData());
        verify(cacheService, never()).set(anyString(), anyString());
    }

    @Test
    void fetchWithCacheAside_databaseFailure_isSurfaced() throws Exception {
        when(cacheService.lookup("demo_records"))
                .thenReturn(new LookupResult(LookupStatus.UNAVAILABLE, null));
        when(recordRepository.findAll()).thenThrow(new RuntimeException("DB error"));
        when(cacheService.getTtlSeconds()).thenReturn(60);

        assertThrows(IllegalStateException.class, () -> cacheDemoService.fetchWithCacheAside());
    }

    @Test
    void invalidateCache_deletesKey() {
        when(cacheService.delete("demo_records")).thenReturn(true);

        boolean result = cacheDemoService.invalidateCache();

        assertTrue(result);
        verify(cacheService).delete("demo_records");
    }

    @Test
    void clearDemoCache_deletesKey() {
        when(cacheService.delete("demo_records")).thenReturn(true);

        boolean result = cacheDemoService.clearDemoCache();

        assertTrue(result);
        verify(cacheService).delete("demo_records");
    }

    @Test
    void fetchWithCacheAside_measuresDuration() throws Exception {
        when(cacheService.lookup("demo_records"))
                .thenReturn(new LookupResult(LookupStatus.MISS, null));
        when(recordRepository.findAll()).thenReturn(sampleRecords);
        when(cacheService.set(eq("demo_records"), anyString())).thenReturn(true);
        when(cacheService.getTtlSeconds()).thenReturn(60);

        CacheDemoResponse response = cacheDemoService.fetchWithCacheAside();

        assertTrue(response.getDurationMs() >= 0, "Duration should be measured");
    }
}
