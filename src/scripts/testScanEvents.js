import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { ethers } from 'ethers';
import { TOKENS, CONTRACT_ABIS } from '../config/constants.js';
import { checkTokenLogs } from '../services/blockchainListener.js';
import { Event } from '../models/Event.js';

async function scanPastEvents() {
  console.log('Connecting DB & RPC for historical event scan...');
  await mongoose.connect(process.env.MONGODB_URI);
  
  const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_HTTP_URL);
  const currentBlock = await provider.getBlockNumber();
  const scanBlocks = 2000;
  const fromBlock = currentBlock - scanBlocks;

  console.log(`Scanning blocks #${fromBlock} -> #${currentBlock} (${scanBlocks} blocks) for USDT & USDC events...`);

  // We can scan historical logs directly
  const usdtLogs = await provider.getLogs({
    address: TOKENS.USDT.address,
    fromBlock,
    toBlock: currentBlock
  });

  console.log(`Found ${usdtLogs.length} total USDT logs in the last ${scanBlocks} blocks.`);

  const usdcLogs = await provider.getLogs({
    address: TOKENS.USDC.address,
    fromBlock,
    toBlock: currentBlock
  });

  console.log(`Found ${usdcLogs.length} total USDC logs in the last ${scanBlocks} blocks.`);

  const ifaceUSDT = new ethers.Interface(CONTRACT_ABIS.USDT);
  let mintOrBurnCount = 0;

  for (const log of usdtLogs) {
    try {
      const parsed = ifaceUSDT.parseLog(log);
      if (!parsed) continue;

      if (parsed.name === 'Issue' || parsed.name === 'Redeem') {
        mintOrBurnCount++;
        console.log(`🎯 USDT ${parsed.name} found! Block #${log.blockNumber}, Tx: ${log.transactionHash}`);
      } else if (parsed.name === 'Transfer') {
        const from = parsed.args[0];
        const to = parsed.args[1];
        if (from === ethers.ZeroAddress || to === ethers.ZeroAddress) {
          mintOrBurnCount++;
          console.log(`🎯 USDT Transfer (Mint/Burn) found! Block #${log.blockNumber}, Tx: ${log.transactionHash}`);
        }
      }
    } catch (e) {}
  }

  const ifaceUSDC = new ethers.Interface(CONTRACT_ABIS.USDC);
  for (const log of usdcLogs) {
    try {
      const parsed = ifaceUSDC.parseLog(log);
      if (!parsed) continue;

      if (parsed.name === 'Mint' || parsed.name === 'Burn') {
        mintOrBurnCount++;
        console.log(`🎯 USDC ${parsed.name} found! Block #${log.blockNumber}, Tx: ${log.transactionHash}`);
      } else if (parsed.name === 'Transfer') {
        const from = parsed.args[0];
        const to = parsed.args[1];
        if (from === ethers.ZeroAddress || to === ethers.ZeroAddress) {
          mintOrBurnCount++;
          console.log(`🎯 USDC Transfer (Mint/Burn) found! Block #${log.blockNumber}, Tx: ${log.transactionHash}`);
        }
      }
    } catch (e) {}
  }

  console.log(`\n✅ Scan complete! Found ${mintOrBurnCount} Mint/Burn events in last ${scanBlocks} blocks.`);
  await mongoose.disconnect();
}

scanPastEvents().catch(console.error);
