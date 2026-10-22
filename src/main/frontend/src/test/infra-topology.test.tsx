import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import InfraTopology, { type NodeStatusMap } from '../components/InfraTopology';

const statuses: NodeStatusMap = {
  web01: { status: 'UP', monitoringType: 'HTTP', latencyMs: 4 },
  app01: { status: 'UP', monitoringType: 'DIRECT_HTTP_INSTANCE', lastSuccessfulAt: '2026-10-22T10:00:00Z' },
  app02: { status: 'DOWN', monitoringType: 'DIRECT_HTTP_INSTANCE', error: 'Connection refused' },
  db01: { status: 'UP', monitoringType: 'JDBC' },
  mc01: { status: 'CHECKING', monitoringType: 'MEMCACHED_READ_WRITE' },
  rmq01: { status: 'DEGRADED', monitoringType: 'TCP_CONNECTIVITY_ONLY' },
  nfs01: { status: 'STALE', monitoringType: 'NFS_MOUNT_READ_ONLY' },
};

describe('Infrastructure topology', () => {
  it('renders all seven VM nodes and a visible current-responder badge', () => {
    render(<InfraTopology nodeStatuses={statuses} currentResponderId="app01" />);
    for (const id of ['web01', 'app01', 'app02', 'db01', 'mc01', 'rmq01', 'nfs01']) {
      expect(screen.getByText(id)).toBeInTheDocument();
    }
    expect(screen.getByText('Current responder')).toBeInTheDocument();
    expect(screen.getByLabelText('app01, Apache Tomcat 10.1, status UP')).toBeInTheDocument();
  });

  it('shows monitoring method, stale state, and safe detail errors', () => {
    render(<InfraTopology nodeStatuses={statuses} currentResponderId="app01" />);
    fireEvent.click(screen.getByLabelText('app02, Apache Tomcat 10.1, status DOWN'));
    expect(screen.getByText('DIRECT HTTP INSTANCE')).toBeInTheDocument();
    expect(screen.getByText('Connection refused')).toBeInTheDocument();
    expect(screen.getAllByText('STALE').length).toBeGreaterThan(0);
  });
});
