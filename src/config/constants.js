import { ethers } from 'ethers';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const MIN_NOTIFICATION_THRESHOLD_USD = 100_000_000; // $100 Million USD minimum

export const TOKENS = {
  BTC: {
    symbol: 'BTC',
    name: 'Bitcoin',
    decimals: 8,
    icon: '🟧',
    color: '#F7931A',
    explorer: 'https://mempool.space'
  },
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    icon: '🔷',
    color: '#627EEA',
    explorer: 'https://etherscan.io'
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD (Native ERC-20)',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7'.toLowerCase(),
    decimals: 6,
    icon: '💵',
    color: '#26A17B',
    explorer: 'https://etherscan.io/token/0xdac17f958d2ee523a2206206994597c13d831ec7'
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin (Native ERC-20)',
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'.toLowerCase(),
    decimals: 6,
    icon: '🔵',
    color: '#2775CA',
    explorer: 'https://etherscan.io/token/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
  }
};

// Strict ABIs limited ONLY to native Mint & Burn events
export const CONTRACT_ABIS = {
  USDT: [
    'event Issue(uint amount)',
    'event Redeem(uint amount)',
    'function totalSupply() view returns (uint256)',
    'function decimals() view returns (uint8)'
  ],
  USDC: [
    'event Mint(address indexed minter, address indexed to, uint256 amount)',
    'event Burn(address indexed burner, uint256 amount)',
    'function totalSupply() view returns (uint256)',
    'function decimals() view returns (uint8)'
  ]
};

// Pre-computed event topic hashes for zero-overhead RPC filtering
export const EVENT_TOPICS = {
  USDT_ISSUE: ethers.id('Issue(uint256)'),
  USDT_REDEEM: ethers.id('Redeem(uint256)'),
  USDC_MINT: ethers.id('Mint(address,address,uint256)'),
  USDC_BURN: ethers.id('Burn(address,uint256)')
};

// Comprehensive Known Exchange & Institutional Wallets (Ethereum & Bitcoin)
export const KNOWN_EXCHANGES = {
  // Binance (Ethereum)
  '0x28c6c06298d514db089934071355e5743bf21d60': 'Binance: Hot Wallet 14',
  '0x21a31ee1afc51d94c2efccaa2092ad1028285549': 'Binance: Hot Wallet 15',
  '0xdfd5293d8e347dfe59e90efd55b2956a1343963d': 'Binance: Hot Wallet 16',
  '0x56ed3064a38997327373ed39c75a800f4473fe65': 'Binance: Hot Wallet 17',
  '0x9696e819e436166ab51083d06764586553eb7ab6': 'Binance: Hot Wallet 18',
  '0xf977814e90da44bfa03b6295a0616a897441acec': 'Binance: Hot Wallet 8',
  '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be': 'Binance: Hot Wallet 1',
  '0xd551234ae421e3bcba99a0da6d736074f22192ff': 'Binance: Hot Wallet 2',
  '0x5a52e96bacdabb82fd05763e25335261b270efcb': 'Binance: Hot Wallet 3',
  '0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503': 'Binance: Hot Wallet',
  '0xbe0eb53f46cd790cd13851d5eff43d12404d33e8': 'Binance: Cold Storage',

  // Coinbase (Ethereum)
  '0x503828976d22510aad0201ac7ec88293211d23da': 'Coinbase: Hot Wallet',
  '0x71660c4005ba85c37ccec55d0c4493e66fe775d3': 'Coinbase 3',
  '0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740': 'Coinbase 2',
  '0x3cd751e6b0078be393132286c442345e5dc49699': 'Coinbase: Prime',
  '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43': 'Coinbase 10',
  '0x04dd872740bc18285514b8f041b31278baaa07d9': 'Coinbase: Hot Wallet',
  '0x3356027eb3a810f69a9d0b81eb7c442ec9a5fd56': 'Coinbase',

  // OKX (Ethereum)
  '0x6cc5f688a315f3dc28a7781717a9a798a59fda7b': 'OKX: Hot Wallet',
  '0x236f9f97e0e62372cfc5e7b57b98d249f3e9f456': 'OKX 2',
  '0xa7efae728d2936e78bda97dc267687568dd593f3': 'OKX 3',
  '0x5041ed759dd4afc3a72b8192c143f72f4724081a': 'OKX 4',

  // Kraken (Ethereum)
  '0x2910543af39aba0cd09dbb2d50200b3e800a63d2': 'Kraken: Hot Wallet',
  '0x0a0c327b0a1085ba3a291e0a81cb531053c7ee09': 'Kraken 2',
  '0xfa52274dd61e1643d2205169732f29114bc240b3': 'Kraken 3',
  '0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0': 'Kraken: Cold Storage',

  // Bybit (Ethereum)
  '0xf89d7b9c22dd3f095ab750e7d0ff3f87d3de44d4': 'Bybit: Hot Wallet',
  '0xee5b5b923f707a8b8942f55078282bb13b43946e': 'Bybit: Hot Wallet 2',
  '0x1db3439a222c519ab44bb1144fc28167b4fa6ee6': 'Bybit 3',

  // Bitfinex (Ethereum)
  '0x876eabf441b2ee5b5b0554fd502a8e0600950cfa': 'Bitfinex: Hot Wallet 1',
  '0x742d35cc6634c0532925a3b844bc454e4438f44e': 'Bitfinex: Hot Wallet 2',
  '0x1151314c646ce4e0efd76d1a4760ae665789f791': 'Bitfinex 3',
  '0x4f877c4456950293297a74ea86307137f81498b0': 'Bitfinex 4',

  // Gate.io (Ethereum)
  '0x0d0707963952f2fba59dd06f2b425ace40b492fe': 'Gate.io 1',
  '0x1c4b70a3968436b9a0a9cf5205c787eb81bb5f8c': 'Gate.io 2',

  // KuCoin (Ethereum)
  '0xd6216fc19db775df9774a6e33526131da7d19a2c': 'KuCoin: Hot Wallet',
  '0x689c56a0f4a90d6527024f0452e2d3761da5f884': 'KuCoin 2',

  // Robinhood (Ethereum)
  '0x40ec5b33f54e0e8a33a975908c5ba1c14e5bbbdf': 'Robinhood: Hot Wallet',
  '0x738cd8463bb4920626a57e3f84307ef11fa7a49f': 'Robinhood 2',

  // HTX / Huobi (Ethereum)
  '0xab5c66752a9e8167967685f1450532fb96d5d24f': 'HTX: Hot Wallet',
  '0xe93381fb4c4f14bda253907b18fad305d799241a': 'Huobi 2',

  // Tether & Circle Official Treasury addresses
  '0x0000000000000000000000000000000000000000': '🔥 Null / Black Hole',
  '0x5754284f345afc66a98fbb0a0afe71e0f007b949': '🏦 Tether Treasury',
  '0xc6cde7c39eb2f0f0095f41570af89efc2c1ea86e': '🏦 Tether Multisig',
  '0x55fe002a30f5c73e9504b7b72ed222a00461b018': '🏦 Circle: Minter',
  '0x72a087a3250ecc10923258843edce837cb0b9c3f': '🏦 Circle: MultiSig'
};

// Known Major Bitcoin Exchange Clusters & Public Hot/Cold Addresses
export const KNOWN_BTC_EXCHANGES = {
  '34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo': 'Binance: Cold Storage',
  'bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h': 'Binance: Hot Wallet',
  '1P5ZEDWTKTFGxQjZphgWPQUpe554WKDfHQ': 'Binance: Whale Vault',
  '39884E3j6KZj82FK4vcCrnGcvWzW22uUL4': 'Binance: Internal',
  'bc1qgdjqv0av3q56jvd82tkdjpy7gdp9ut8tlqmgrpmv24sq90ecnvqqjwvw97': 'Bitfinex: Cold Storage',
  '1Kr6561uagrfdRLvmAGCPSJBgVd55ndDUw': 'Bitfinex: Hot Wallet',
  '3FHNBLobJgtLtRevR6vmTswBR8nnh4568Q': 'Coinbase: Cold Storage',
  '1FzWLkAahxunAQccbAJxfngQooF9xUKyG9': 'Coinbase: Prime',
  'bc1q5p960v7a2euvk4q8hphv4u3w5k4u9w5k4u9w5k': 'OKX: Hot Wallet',
  'bc1q7w04859a2jkvqg4x2jkvqg4x2jkvqg4x2jkvqg': 'Kraken: Hot Wallet',
  'bc1ql49ydapnjafl5t2cp9zqpjwe6pdgmxy98859v2': 'Robinhood: Cold Storage'
};

// Helper to determine if an Ethereum or Bitcoin address belongs to a known exchange
export const isExchangeAddress = (address) => {
  if (!address) return false;
  const lower = address.toLowerCase();
  if (KNOWN_EXCHANGES[lower]) {
    const label = KNOWN_EXCHANGES[lower].toLowerCase();
    return (
      label.includes('binance') ||
      label.includes('coinbase') ||
      label.includes('kraken') ||
      label.includes('okx') ||
      label.includes('bybit') ||
      label.includes('bitfinex') ||
      label.includes('gate.io') ||
      label.includes('kucoin') ||
      label.includes('robinhood') ||
      label.includes('htx') ||
      label.includes('huobi')
    );
  }
  if (KNOWN_BTC_EXCHANGES[address]) {
    return true;
  }
  return false;
};

// Helper to retrieve exchange or institutional name
export const getExchangeName = (address) => {
  if (!address) return null;
  const lower = address.toLowerCase();
  if (KNOWN_EXCHANGES[lower]) {
    return KNOWN_EXCHANGES[lower];
  }
  if (KNOWN_BTC_EXCHANGES[address]) {
    return KNOWN_BTC_EXCHANGES[address];
  }
  return null;
};

export const getEntityLabel = (address) => {
  if (!address) return 'Unknown Address';
  const lower = address.toLowerCase();
  if (KNOWN_EXCHANGES[lower]) {
    return KNOWN_EXCHANGES[lower];
  }
  if (KNOWN_BTC_EXCHANGES[address]) {
    return KNOWN_BTC_EXCHANGES[address];
  }
  if (address.length > 14) {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
  return address;
};

export const EXPLORER_BASE = 'https://etherscan.io';
