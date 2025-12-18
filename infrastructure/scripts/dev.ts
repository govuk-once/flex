#!/usr/bin/env node
/**
 * Unified development CLI that coordinates CDK watch and Lambda Live Debugger
 * 
 * This script:
 * 1. Watches for file changes
 * 2. Triggers CDK watch when stack files change
 * 3. Waits for CloudFormation to stabilize
 * 4. Restarts Lambda Live Debugger only after stack is ready
 * 
 * Usage:
 *   npm run dev:unified
 *   or
 *   npx ts-node scripts/dev.ts
 */

import { spawn, ChildProcess, exec } from 'child_process';
import { watch, existsSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Get script directory
const scriptDir = __dirname || process.cwd();

// Configuration
const STACK_NAME = process.env.STACK_NAME || 'FlexApiStack';
const REGION = process.env.AWS_REGION || 'eu-west-2';

// Process references
let cdkProcess: ChildProcess | null = null;
let lambdaBuildProcess: ChildProcess | null = null;
let lldProcess: ChildProcess | null = null;
let restartTimeout: NodeJS.Timeout | null = null;
let isRestarting = false;

// Files/directories to watch
const watchPaths = [
  join(scriptDir, '../lib'),                    // CDK stack files
  join(scriptDir, '../lldebugger.config.ts'),  // Debugger config
  join(scriptDir, '../cdk.json'),              // CDK config
];

// Lambda source directories to watch
const lambdaWatchPaths = [
  join(scriptDir, '../lambda'),                 // Lambda source files
];

/**
 * Check if there are any recent stack events indicating an update in progress
 */
async function hasInProgressOperations(stackName: string): Promise<boolean> {
  try {
    // Check recent stack events for in-progress operations
    // Look at the most recent event to see if an update is happening
    const { stdout } = await execAsync(
      `aws cloudformation describe-stack-events --stack-name ${stackName} --region ${REGION} --max-items 5 --query "StackEvents[0].ResourceStatus" --output text 2>/dev/null || echo ""`
    );
    
    const status = stdout.trim();
    // Check if the most recent event indicates an operation in progress
    return status.includes('IN_PROGRESS') || status.includes('PROGRESS');
  } catch {
    return false;
  }
}

/**
 * Wait for CloudFormation stack to be in a stable state
 * This is deterministic - it waits for any deployment to complete
 */
async function waitForStackStable(
  stackName: string,
  maxWaitSeconds: number = 180
): Promise<boolean> {
  const startTime = Date.now();
  const checkInterval = 3000; // Check every 3 seconds
  let wasUpdating = false;
  
  console.log(`⏳ Waiting for stack ${stackName} to stabilize...`);
  
  while (Date.now() - startTime < maxWaitSeconds * 1000) {
    try {
      // First check if there are any in-progress operations
      const hasOperations = await hasInProgressOperations(stackName);
      
      // Get stack status
      const { stdout } = await execAsync(
        `aws cloudformation describe-stacks --stack-name ${stackName} --region ${REGION} --query "Stacks[0].StackStatus" --output text 2>/dev/null || echo "NOT_FOUND"`
      );
      
      const status = stdout.trim();
      
      // Check if stack is in an updating state
      const isUpdating = 
        status.includes('IN_PROGRESS') ||
        status === 'REVIEW_IN_PROGRESS' ||
        hasOperations;
      
      if (isUpdating) {
        wasUpdating = true;
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        process.stdout.write(`\r⏳ Stack ${stackName} updating... (${status}) - ${elapsed}s`);
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        continue;
      }
      
      // Stack is stable if it's in one of these states
      if (
        status === 'CREATE_COMPLETE' ||
        status === 'UPDATE_COMPLETE' ||
        status === 'DELETE_COMPLETE' ||
        status === 'ROLLBACK_COMPLETE' ||
        status === 'UPDATE_ROLLBACK_COMPLETE'
      ) {
        // If we were updating, wait a bit more to ensure everything is settled
        if (wasUpdating) {
          console.log(`\n✅ Stack ${stackName} completed (${status}), waiting 5 seconds for resources to be ready...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          console.log(`\n✅ Stack ${stackName} is stable (${status})`);
        }
        return true;
      }
      
      // Stack not found - might be first deploy
      if (status === 'NOT_FOUND' || !status) {
        console.log(`\n⚠️  Stack ${stackName} not found, proceeding...`);
        return true;
      }
      
      // Unknown state - proceed
      console.log(`\n⚠️  Stack ${stackName} in state: ${status}, proceeding...`);
      return true;
      
    } catch (error: any) {
      // If AWS CLI fails, wait a bit and retry
      if (error.message.includes('does not exist')) {
        console.log(`\n⚠️  Stack ${stackName} does not exist yet, proceeding...`);
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }
  
  console.log(`\n⏰ Timeout waiting for stack ${stackName} to stabilize, proceeding...`);
  return true;
}

function startLambdaBuildWatcher() {
  if (lambdaBuildProcess) {
    return; // Already running
  }

  console.log('🔨 Starting Lambda build watcher...');
  
  // Run esbuild in watch mode for all Lambda functions
  // This rebuilds Lambda code automatically when source files change
  lambdaBuildProcess = spawn('npm', ['run', 'build:lambda:watch'], {
    stdio: 'inherit',
    shell: true,
    cwd: join(scriptDir, '..'),
  });

  lambdaBuildProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`❌ Lambda build watcher exited with code ${code}`);
    }
    lambdaBuildProcess = null;
  });

  lambdaBuildProcess.on('error', (error) => {
    console.error('❌ Error starting Lambda build watcher:', error);
    lambdaBuildProcess = null;
  });
}

function startCdkWatch() {
  if (cdkProcess) {
    return; // Already running
  }

  console.log('📦 Starting CDK watch...');
  
  // Run CDK watch with hotswap
  // This will detect changes in dist/lambda and hotswap them
  cdkProcess = spawn('npx', ['cdk', 'watch', '--hotswap'], {
    stdio: 'pipe', // Pipe output so we can detect when deployments happen
    shell: true,
    cwd: join(scriptDir, '..'),
  });

  // Forward CDK output to console
  cdkProcess.stdout?.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(output);
    
    // Detect when CDK starts a deployment
    if (output.includes('hotswap') || output.includes('deploying') || output.includes('Stack')) {
      console.log('📦 CDK deployment detected...');
    }
  });

  cdkProcess.stderr?.on('data', (data) => {
    process.stderr.write(data);
  });

  cdkProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`❌ CDK watch exited with code ${code}`);
    }
    cdkProcess = null;
  });

  cdkProcess.on('error', (error) => {
    console.error('❌ Error starting CDK watch:', error);
    cdkProcess = null;
  });
}

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

async function handleFileChange() {
  if (isRestarting) {
    return; // Already handling a restart
  }

  // Debounce rapid file changes
  if (restartTimeout) {
    clearTimeout(restartTimeout);
  }

  restartTimeout = setTimeout(async () => {
    isRestarting = true;
    console.log('\n📝 Detected file changes...');
    
    // Start CDK watch if not already running
    if (!cdkProcess) {
      startCdkWatch();
      // Give CDK a moment to start and detect changes
      console.log('⏳ Waiting 5 seconds for CDK to start...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Wait a bit for CDK to initiate the deployment (if it will)
    console.log('⏳ Waiting 10 seconds for CDK to initiate deployment (if needed)...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Now wait for CloudFormation stack to stabilize
    // This is deterministic - it waits for any deployment to complete
    await waitForStackStable(STACK_NAME, 180);
    
    // Additional buffer for Lambda functions to be fully ready
    // Lambda functions need a moment after CloudFormation completes
    console.log('⏳ Waiting 10 seconds for Lambda functions to be fully ready...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Restart Lambda Live Debugger
    console.log('🔄 Restarting Lambda Live Debugger...\n');
    startLldebugger();
    
    isRestarting = false;
  }, 2000); // Wait 2 seconds after last file change before starting checks
}

function setupWatcher() {
  console.log('👀 Setting up file watchers...');
  console.log('   - lib/**/*.ts (CDK stack files)');
  console.log('   - lambda/**/*.ts (Lambda source files - handled by build watcher)');
  console.log('   - lldebugger.config.ts (debugger config)');
  console.log('   - cdk.json (CDK config)');
  console.log(`   - Stack: ${STACK_NAME}`);
  console.log('');

  // Watch stack files for LLD restart coordination
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
            console.log(`📝 Stack file changed: ${filename}`);
            handleFileChange();
          }
        }
      );
      console.log(`✅ Watching: ${watchPath}`);
    } catch (error: any) {
      console.warn(`⚠️  Could not watch ${watchPath}:`, error.message);
    }
  });

  // Note: Lambda files are watched by the build watcher (esbuild --watch)
  // which automatically rebuilds them. CDK watch then detects the changes
  // in dist/lambda and hotswaps them.
}

// Handle graceful shutdown
function cleanup() {
  console.log('\n👋 Shutting down...');
  
  if (restartTimeout) {
    clearTimeout(restartTimeout);
  }
  
  if (lambdaBuildProcess) {
    console.log('🛑 Stopping Lambda build watcher...');
    lambdaBuildProcess.kill('SIGTERM');
  }
  
  if (cdkProcess) {
    console.log('🛑 Stopping CDK watch...');
    cdkProcess.kill('SIGTERM');
  }
  
  if (lldProcess) {
    console.log('🛑 Stopping Lambda Live Debugger...');
    lldProcess.kill('SIGTERM');
  }
  
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start everything
console.log('🚀 Starting unified development environment...\n');
console.log('   This will:');
console.log('   1. Start Lambda build watcher (rebuilds Lambda code on changes)');
console.log('   2. Start CDK watch (hotswaps Lambda code changes)');
console.log('   3. Start Lambda Live Debugger');
console.log('   4. Watch for stack file changes and coordinate restarts');
console.log('');

setupWatcher();

// Build Lambda code first
console.log('🔨 Building Lambda code initially...');
exec('npm run build:lambda', { cwd: join(scriptDir, '..') }, (error) => {
  if (error) {
    console.warn('⚠️  Lambda build had issues, continuing anyway...');
  }
  
  // Start Lambda build watcher (watches lambda/**/*.ts and rebuilds)
  startLambdaBuildWatcher();
  
  // Start CDK watch (watches dist/lambda and hotswaps)
  setTimeout(() => {
    startCdkWatch();
  }, 2000);
  
  // Wait for initial stack check, then start LLD
  setTimeout(async () => {
    // Check if stack exists and is stable before starting LLD
    await waitForStackStable(STACK_NAME, 30);
    console.log('⏳ Waiting 5 seconds before starting debugger...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    startLldebugger();
  }, 5000);
});

