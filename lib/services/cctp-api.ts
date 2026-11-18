/**
 * CCTP Transfer API service
 * Calls the aggregator backend /admin/cctp endpoints
 * Falls back to mock data if USE_MOCK_API is set to 'true'
 */

const API_BASE = process.env.NEXT_PUBLIC_AGGREGATOR_URL || 'http://localhost:8000';
const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true';

export interface CctpTransfer {
  id: number;
  entity_id: number;
  direction: string;
  source_chain: string;
  dest_chain: string;
  status: string;
  amount_usdc: string;
  fee_usdc: string | null;
  source_tx_hash: string;
  burn_tx_hash: string | null;
  mint_tx_hash: string | null;
  error: string | null;
  stuck: boolean;
  age_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export interface Stage {
  stage: string;
  chain: string;
  tx_hash: string | null;
  payer: string;
  explorer_url: string | null;
  fee?: {
    gas_native: string;
    unit: string;
    gas_usd: string | null;
  };
}

export interface TransferDetail extends CctpTransfer {
  max_fee_usdc: string | null;
  source_log_index: number;
  inbox_id: string | null;
  nuvion_account_id: string | null;
  home_stellar_account_id: string | null;
  evm_mint_recipient: string | null;
  offramp_order_id: string | null;
  claim_owner: string | null;
  claimed_at: string | null;
  has_attestation: boolean;
  message_hash: string | null;
}

export interface TransferDetailResponse {
  transfer: TransferDetail;
  stages: Stage[];
  circle_fee_usdc: string | null;
  total_element_gas_usd: string | null;
}

/**
 * List CCTP transfers with filtering and pagination
 */
export async function listCctpTransfers(
  options: {
    status?: string;
    direction?: string;
    chain?: string;
    entity_id?: number;
    min_age_minutes?: number;
    limit?: number;
    offset?: number;
  } = {}
) {
  if (USE_MOCK_API) {
    return listCctpTransfersMock(options);
  }

  const params = new URLSearchParams();
  if (options.status) params.append('status', options.status);
  if (options.direction) params.append('direction', options.direction);
  if (options.chain) params.append('chain', options.chain);
  if (options.entity_id) params.append('entity_id', options.entity_id.toString());
  if (options.min_age_minutes !== undefined) params.append('min_age_minutes', options.min_age_minutes.toString());
  params.append('limit', (options.limit ?? 50).toString());
  params.append('offset', (options.offset ?? 0).toString());

  const response = await fetch(`${API_BASE}/admin/cctp/transfers?${params}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch transfers: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * Get detailed view of a single CCTP transfer with stage info and fees
 */
export async function getCctpTransferDetail(
  transferId: number,
  includeFees: boolean = true
) {
  if (USE_MOCK_API) {
    return getCctpTransferDetailMock(transferId);
  }

  const params = new URLSearchParams();
  params.append('include_fees', includeFees.toString());

  const response = await fetch(`${API_BASE}/admin/cctp/transfers/${transferId}?${params}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch transfer detail: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data as TransferDetailResponse;
}

/**
 * Get stuck transfers summary
 */
export async function getStuckTransfers(min_age_minutes: number = 30) {
  const params = new URLSearchParams();
  params.append('min_age_minutes', min_age_minutes.toString());

  const response = await fetch(`${API_BASE}/admin/cctp/stuck?${params}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch stuck transfers: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * Get sponsor gas status
 */
export async function getGasStatus() {
  const response = await fetch(`${API_BASE}/admin/cctp/gas`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch gas status: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

// ===== MOCK DATA FOR LOCAL TESTING =====

function getMockTransfers(): CctpTransfer[] {
  const now = new Date();
  return [
    {
      id: 1001,
      entity_id: 42,
      direction: 'evm_to_stellar',
      source_chain: 'base',
      dest_chain: 'stellar',
      status: 'detected',
      amount_usdc: '1000.00',
      fee_usdc: null,
      source_tx_hash: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
      burn_tx_hash: null,
      mint_tx_hash: null,
      error: null,
      stuck: false,
      age_minutes: 2,
      created_at: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
      updated_at: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
    },
    {
      id: 1002,
      entity_id: 42,
      direction: 'evm_to_stellar',
      source_chain: 'base',
      dest_chain: 'stellar',
      status: 'attesting',
      amount_usdc: '2500.00',
      fee_usdc: '0.50',
      source_tx_hash: '0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c',
      burn_tx_hash: '0x3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d',
      mint_tx_hash: null,
      error: null,
      stuck: false,
      age_minutes: 8,
      created_at: new Date(now.getTime() - 8 * 60 * 1000).toISOString(),
      updated_at: new Date(now.getTime() - 8 * 60 * 1000).toISOString(),
    },
    {
      id: 1003,
      entity_id: 42,
      direction: 'evm_to_stellar',
      source_chain: 'base',
      dest_chain: 'stellar',
      status: 'minting',
      amount_usdc: '500.00',
      fee_usdc: '0.50',
      source_tx_hash: '0x4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e',
      burn_tx_hash: '0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f',
      mint_tx_hash: '0x6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a',
      error: null,
      stuck: false,
      age_minutes: 15,
      created_at: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
      updated_at: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
    },
    {
      id: 1004,
      entity_id: 42,
      direction: 'evm_to_stellar',
      source_chain: 'base',
      dest_chain: 'stellar',
      status: 'completed',
      amount_usdc: '10000.00',
      fee_usdc: '1.00',
      source_tx_hash: '0x7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b',
      burn_tx_hash: '0x8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c',
      mint_tx_hash: '0x9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d',
      error: null,
      stuck: false,
      age_minutes: 45,
      created_at: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
      updated_at: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
    },
    {
      id: 1005,
      entity_id: 43,
      direction: 'evm_to_stellar',
      source_chain: 'base',
      dest_chain: 'stellar',
      status: 'attesting',
      amount_usdc: '750.00',
      fee_usdc: '0.50',
      source_tx_hash: '0x0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e',
      burn_tx_hash: '0x1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f',
      mint_tx_hash: null,
      error: 'Circle attestation timeout',
      stuck: true,
      age_minutes: 65,
      created_at: new Date(now.getTime() - 65 * 60 * 1000).toISOString(),
      updated_at: new Date(now.getTime() - 65 * 60 * 1000).toISOString(),
    },
    {
      id: 1006,
      entity_id: 44,
      direction: 'evm_to_stellar',
      source_chain: 'base',
      dest_chain: 'stellar',
      status: 'failed',
      amount_usdc: '2000.00',
      fee_usdc: null,
      source_tx_hash: '0x2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a',
      burn_tx_hash: null,
      mint_tx_hash: null,
      error: 'Insufficient gas sponsor balance on Base',
      stuck: false,
      age_minutes: 120,
      created_at: new Date(now.getTime() - 120 * 60 * 1000).toISOString(),
      updated_at: new Date(now.getTime() - 120 * 60 * 1000).toISOString(),
    },
  ];
}

function getMockTransferDetail(id: number): TransferDetailResponse | null {
  const transfers = getMockTransfers();
  const transfer = transfers.find((t) => t.id === id);
  if (!transfer) return null;

  const stages: Stage[] = [
    {
      stage: 'deposit',
      chain: transfer.source_chain,
      tx_hash: transfer.source_tx_hash,
      payer: 'customer',
      explorer_url: transfer.source_tx_hash
        ? `https://basescan.org/tx/${transfer.source_tx_hash}`
        : null,
      fee: { gas_native: '0.0012', unit: 'ETH', gas_usd: '0.45' },
    },
  ];

  if (transfer.burn_tx_hash) {
    stages.push({
      stage: 'burn',
      chain: transfer.source_chain,
      tx_hash: transfer.burn_tx_hash,
      payer: 'gas sponsor',
      explorer_url: `https://basescan.org/tx/${transfer.burn_tx_hash}`,
      fee: { gas_native: '0.0018', unit: 'ETH', gas_usd: '0.67' },
    });
  }

  if (transfer.mint_tx_hash) {
    stages.push({
      stage: 'mint',
      chain: transfer.dest_chain,
      tx_hash: transfer.mint_tx_hash,
      payer: 'circle sponsor',
      explorer_url: `https://stellar.expert/explorer/public/tx/${transfer.mint_tx_hash}`,
      fee: { gas_native: '0.00001', unit: 'XLM', gas_usd: '0.0001' },
    });
  }

  return {
    transfer: transfer as TransferDetail,
    stages,
    circle_fee_usdc: transfer.fee_usdc,
    total_element_gas_usd: '1.12',
  };
}

// ===== MOCK API FUNCTIONS =====

async function listCctpTransfersMock(
  options: {
    status?: string;
    direction?: string;
    chain?: string;
    entity_id?: number;
    min_age_minutes?: number;
    limit?: number;
    offset?: number;
  } = {}
) {
  const all = getMockTransfers();
  let filtered = all;

  if (options.status) {
    filtered = filtered.filter((t) => t.status === options.status);
  }
  if (options.direction) {
    filtered = filtered.filter((t) => t.direction === options.direction);
  }
  if (options.entity_id) {
    filtered = filtered.filter((t) => t.entity_id === options.entity_id);
  }

  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const total = filtered.length;
  const page = filtered.slice(offset, offset + limit);

  return {
    transfers: page,
    pagination: { limit, offset, total },
  };
}

async function getCctpTransferDetailMock(transferId: number) {
  const detail = getMockTransferDetail(transferId);
  if (!detail) {
    throw new Error('Transfer not found');
  }
  return detail;
}
