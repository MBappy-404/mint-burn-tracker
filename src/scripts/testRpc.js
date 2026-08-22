import dotenv from 'dotenv';
dotenv.config();

import { ethers } from 'ethers';
import { TOKENS, CONTRACT_ABIS } from '../config/constants.js';

async function testRpc() {
  console.log('Testing Alchemy Ethereum RPC Connection...');
  const url = process.env.ALCHEMY_HTTP_URL;
  const provider = new ethers.JsonRpcProvider(url);

  const network = await provider.getNetwork();
  const blockNumber = await provider.getBlockNumber();
  const feeData = await provider.getFeeData();

  console.log('✅ Alchemy RPC Connected!');
  console.log(`🌐 Chain ID: ${network.chainId} (Ethereum Mainnet)`);
  console.log(`📦 Latest Block Number: #${blockNumber.toLocaleString()}`);
  console.log(`⛽ Gas Price: ${ethers.formatUnits(feeData.gasPrice || 0, 'gwei')} Gwei`);

  // Query USDT Contract
  const usdtContract = new ethers.Contract(TOKENS.USDT.address, CONTRACT_ABIS.USDT, provider);
  const usdtSupply = await usdtContract.totalSupply();
  const usdtFormatted = Number(usdtSupply) / 1e6;
  console.log(`💵 USDT Total Supply on Ethereum: $${usdtFormatted.toLocaleString()}`);

  // Query USDC Contract
  const usdcContract = new ethers.Contract(TOKENS.USDC.address, CONTRACT_ABIS.USDC, provider);
  const usdcSupply = await usdcContract.totalSupply();
  const usdcFormatted = Number(usdcSupply) / 1e6;
  console.log(`🔵 USDC Total Supply on Ethereum: $${usdcFormatted.toLocaleString()}`);
}

testRpc().catch((err) => {
  console.error('❌ RPC Test Failed:', err.message);
  process.exit(1);
});
