export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const TOKENS = {
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7'.toLowerCase(),
    decimals: 6,
    icon: '💵',
    color: '#26A17B',
    explorer: 'https://etherscan.io/token/0xdac17f958d2ee523a2206206994597c13d831ec7'
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'.toLowerCase(),
    decimals: 6,
    icon: '🔵',
    color: '#2775CA',
    explorer: 'https://etherscan.io/token/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
  }
};

export const CONTRACT_ABIS = {
  USDT: [
    'event Issue(uint amount)',
    'event Redeem(uint amount)',
    'event Transfer(address indexed from, address indexed to, uint value)',
    'function totalSupply() view returns (uint256)',
    'function decimals() view returns (uint8)'
  ],
  USDC: [
    'event Mint(address indexed minter, address indexed to, uint256 amount)',
    'event Burn(address indexed burner, uint256 amount)',
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'function totalSupply() view returns (uint256)',
    'function decimals() view returns (uint8)'
  ]
};

export const KNOWN_ADDRESSES = {
  '0x0000000000000000000000000000000000000000': '🔥 Null / Black Hole',
  '0x5754284f345afc66a98fbb0a0afe71e0f007b949': '🏦 Tether Treasury',
  '0xc6cde7c39eb2f0f0095f41570af89efc2c1ea86e': '🏦 Tether Multisig',
  '0x55fe002a30f5c73e9504b7b72ed222a00461b018': '🏦 Circle: Minter',
  '0x72a087a3250ecc10923258843edce837cb0b9c3f': '🏦 Circle: MultiSig',
  '0x28c6c06298d514db089934071355e5743bf21d60': '🟡 Binance: Hot Wallet 14',
  '0x21a31ee1afc51d94c2efccaa2092ad1028285549': '🟡 Binance: Hot Wallet 15',
  '0xdfd5293d8e347dfe59e90efd55b2956a1343963d': '🟡 Binance: Hot Wallet 16',
  '0x503828976d22510aad0201ac7ec88293211d23da': '🔵 Coinbase: Hot Wallet',
  '0x71660c4005ba85c37ccec55d0c4493e66fe775d3': '🔵 Coinbase 3',
  '0x876eabf441b2ee5b5b0554fd502a8e0600950cfa': '🟣 Bitfinex 1',
  '0x742d35cc6634c0532925a3b844bc454e4438f44e': '🟣 Bitfinex 2',
  '0x2910543af39aba0cd09dbb2d50200b3e800a63d2': '🔴 Kraken 4',
  '0x0d0707963952f2fba59dd06f2b425ace40b492fe': '🔴 Gate.io'
};

export const getEntityLabel = (address) => {
  if (!address) return 'Unknown Address';
  const lower = address.toLowerCase();
  if (KNOWN_ADDRESSES[lower]) {
    return KNOWN_ADDRESSES[lower];
  }
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

export const EXPLORER_BASE = 'https://etherscan.io';
