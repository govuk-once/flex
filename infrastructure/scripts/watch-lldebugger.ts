#!/usr/bin/env node
/**
 * Wrapper script that watches for CDK stack changes and restarts Lambda Live Debugger
 * 
 * Usage:
 *   npm run lldebugger:watch
 *   or
 *   npx ts-node scripts/watch-lldebugger.ts
 */

import { spawn, ChildProcess, exec } from 'child_process';
import { watch, existsSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Get script directory - works with both ts-node and compiled JS
const scriptDir = __dirname || process.cwd();

// Files/directories to watch for changes
const watchPaths = [
  join(scriptDir, '../lib'),                    // CDK stack files
  join(scriptDir, '../lldebugger.config.ts'),  // Debugger config
  join(scriptDir, '../cdk.json'),               // CDK config
];

let lldProcess: ChildProcess | null = null;
let restartTimeout: NodeJS.Timeout | null = null;

function startLldebugger() {
  console.log('🚀 Starting Lambda Live Debugger...');
  
  // Kill existing process if running
  if (lldProcess) {
    console.log('🛑 Stopping previous debugger instance...');
    lldProcess.kill('SIGTERM');
    lldProcess = null;
  }

  // Start new process
  lldProcess = spawn('npx', ['lambda-live-debugger'], {
    stdio: 'inherit',
    shell: true,
    cwd: join(scriptDir, '..'),
  });

  lldProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`❌ Lambda Live Debugger exited with code ${code}`);
    }
    lldProcess = null;
  });

  lldProcess.on('error', (error) => {
    console.error('❌ Error starting Lambda Live Debugger:', error);
    lldProcess = null;
  });
}

/**
 * Wait for CloudFormation stack to be in a stable state
 * Returns true if stack is stable, false if we should retry
 */
async function waitForStackStable(stackName: string, maxWaitSeconds: number = 60): Promise<boolean> {
  const startTime = Date.now();
  const checkInterval = 2000; // Check every 2 seconds
  
  while (Date.now() - startTime < maxWaitSeconds * 1000) {
    try {
      const { stdout } = await execAsync(
        `aws cloudformation describe-stacks --stack-name ${stackName} --query "Stacks[0].StackStatus" --output text 2>/dev/null || echo "NOT_FOUND"`
      );
      
      const status = stdout.trim();
      
      // Stack is stable if it's in one of these states
      if (
        status === 'CREATE_COMPLETE' ||
        status === 'UPDATE_COMPLETE' ||
        status === 'DELETE_COMPLETE' ||
        status === 'ROLLBACK_COMPLETE' ||
        status === 'UPDATE_ROLLBACK_COMPLETE'
      ) {
        console.log(`✅ Stack ${stackName} is stable (${status})`);
        return true;
      }
      
      // Stack is still updating
      if (
        status.includes('IN_PROGRESS') ||
        status === 'REVIEW_IN_PROGRESS'
      ) {
        console.log(`⏳ Stack ${stackName} is still updating (${status}), waiting...`);
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        continue;
      }
      
      // Stack not found or other state - assume stable
      if (status === 'NOT_FOUND' || !status) {
        console.log(`⚠️  Stack ${stackName} not found, proceeding anyway...`);
        return true;
      }
      
      // Unknown state - proceed with caution
      console.log(`⚠️  Stack ${stackName} in unknown state: ${status}, proceeding...`);
      return true;
      
    } catch (error: any) {
      // If AWS CLI fails, assume stack is stable and proceed
      console.warn(`⚠️  Could not check stack status: ${error.message}, proceeding...`);
      return true;
    }
  }
  
  console.warn(`⏰ Timeout waiting for stack ${stackName} to stabilize, proceeding anyway...`);
  return true;
}

async function restartLldebugger() {
  // Debounce restarts to avoid multiple restarts on rapid file changes
  if (restartTimeout) {
    clearTimeout(restartTimeout);
  }

  restartTimeout = setTimeout(async () => {
    console.log('📝 Detected changes, waiting for CloudFormation stack to stabilize...');
    
    // Wait a bit for CDK to start the deployment
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Wait for CloudFormation stack to be stable
    const stackName = process.env.STACK_NAME || 'FlexApiStack';
    await waitForStackStable(stackName, 60);
    
    // Additional delay to ensure Lambda functions are fully ready
    console.log('⏳ Waiting additional 3 seconds for Lambda functions to be ready...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('🚀 Restarting Lambda Live Debugger...');
    startLldebugger();
  }, 2000); // Wait 2 seconds after last change before starting checks
}

// Watch for file changes
function setupWatcher() {
  console.log('👀 Watching for changes in:');
  console.log('   - lib/**/*.ts (CDK stack files)');
  console.log('   - lldebugger.config.ts (debugger config)');
  console.log('   - cdk.json (CDK config)');
  console.log('');

  watchPaths.forEach((watchPath) => {
    if (!existsSync(watchPath)) {
      console.warn(`⚠️  Path does not exist: ${watchPath}`);
      return;
    }
    
    try {
      watch(
        watchPath,
        { recursive: watchPath.endsWith('lib') },
        (eventType, filename) => {
          if (filename && (filename.endsWith('.ts') || filename.endsWith('.json'))) {
            console.log(`📝 File changed: ${filename}`);
            restartLldebugger();
          }
        }
      );
      console.log(`✅ Watching: ${watchPath}`);
    } catch (error: any) {
      console.warn(`⚠️  Could not watch ${watchPath}:`, error.message);
    }
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  if (lldProcess) {
    lldProcess.kill('SIGTERM');
  }
  if (restartTimeout) {
    clearTimeout(restartTimeout);
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down...');
  if (lldProcess) {
    lldProcess.kill('SIGTERM');
  }
  if (restartTimeout) {
    clearTimeout(restartTimeout);
  }
  process.exit(0);
});

// Get stack name from environment or use default
const stackName = process.env.STACK_NAME || 'FlexApiStack';
console.log(`📦 Monitoring stack: ${stackName}`);
console.log('');

// Start watching and launch debugger
setupWatcher();
startLldebugger();
