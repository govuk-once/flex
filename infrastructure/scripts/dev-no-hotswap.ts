#!/usr/bin/env node
/**
 * Unified development CLI without hotswap - uses full CloudFormation deployments
 * 
 * This script:
 * 1. Watches for file changes
 * 2. Triggers CDK watch (without hotswap) when stack files change
 * 3. Waits for CloudFormation to stabilize
 * 4. Restarts Lambda Live Debugger only after stack is ready
 * 
 * Usage:
 *   npm run dev:unified:no-hotswap
 *   or
 *   npx ts-node scripts/dev-no-hotswap.ts
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
  join(scriptDir, '../cdk.json'),               // CDK config
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
 * Verify that all Lambda functions in the stack actually exist and are accessible
 * Also ensures they've been updated recently (within last 5 minutes) to catch name changes
 */
async function verifyLambdasExist(stackName: string, maxWaitSeconds: number = 120): Promise<boolean> {
  const startTime = Date.now();
  const checkInterval = 5000; // Check every 5 seconds
  const maxAgeSeconds = 300; // Functions should be updated within last 5 minutes
  
  console.log(`⏳ Verifying Lambda functions exist and are current...`);
  
  while (Date.now() - startTime < maxWaitSeconds * 1000) {
    try {
      // Get all Lambda function names from the stack
      const { stdout } = await execAsync(
        `aws cloudformation describe-stack-resources --stack-name ${stackName} --region ${REGION} --query "StackResources[?ResourceType=='AWS::Lambda::Function'].PhysicalResourceId" --output text 2>/dev/null || echo ""`
      );
      
      const functionNames = stdout.trim().split(/\s+/).filter((name: string) => name && name !== 'None');
      
      if (functionNames.length === 0) {
        console.log('⚠️  No Lambda functions found in stack, proceeding...');
        return true;
      }
      
      // Verify each Lambda function actually exists, is accessible, and is recent
      let allExist = true;
      const now = Date.now();
      
      for (const functionName of functionNames) {
        try {
          const { stdout: funcInfo } = await execAsync(
            `aws lambda get-function --function-name ${functionName} --region ${REGION} --query "Configuration.LastModified" --output text 2>/dev/null`
          );
          
          const lastModified = funcInfo.trim();
          if (lastModified) {
            const modifiedTime = new Date(lastModified).getTime();
            const ageSeconds = (now - modifiedTime) / 1000;
            
            // Function should have been updated recently (within last 5 minutes)
            // This catches cases where functions were recreated with new names
            if (ageSeconds > maxAgeSeconds) {
              allExist = false;
              const elapsed = Math.floor((Date.now() - startTime) / 1000);
              process.stdout.write(`\r⏳ Waiting for ${functionName} to be current... (updated ${Math.floor(ageSeconds)}s ago) - ${elapsed}s`);
              break;
            }
          }
        } catch (error: any) {
          // Function doesn't exist yet or isn't accessible
          allExist = false;
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          process.stdout.write(`\r⏳ Waiting for ${functionName} to exist... - ${elapsed}s`);
          break;
        }
      }
      
      if (allExist) {
        console.log(`\n✅ All Lambda functions exist, are accessible, and are current`);
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    } catch (error: any) {
      // If we can't check, wait a bit and retry
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }
  
  console.log(`\n⏰ Timeout verifying Lambda functions exist, proceeding anyway...`);
  return true;
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

  console.log('📦 Starting CDK watch (full CloudFormation deployments)...');
  
  // Run CDK watch WITHOUT hotswap - uses full CloudFormation deployments
  cdkProcess = spawn('npx', ['cdk', 'watch', '--no-hotswap'], {
    stdio: 'pipe', // Pipe output so we can detect when deployments happen
    shell: true,
    cwd: join(scriptDir, '..'),
  });

  // Forward CDK output to console
  cdkProcess.stdout?.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(output);
    
    // Detect when CDK starts a deployment
    if (output.includes('deploying') || output.includes('Stack')) {
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

function startLldebugger(): Promise<void> {
  console.log('🚀 Starting Lambda Live Debugger...');
  
  // Kill existing process if running
  if (lldProcess) {
    console.log('🛑 Stopping previous debugger instance...');
    lldProcess.kill('SIGTERM');
    lldProcess = null;
    
    // Give it a moment to fully shut down and clear cache
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        // Clear any cached CDK compilation that might have stale Lambda names
        // The debugger will recompile CDK on next start, getting fresh Lambda names
        try {
          const { rmSync } = require('fs');
          const cacheDir = join(scriptDir, '..', '.lldebugger', 'compiledCdk.cjs');
          if (existsSync(cacheDir)) {
            rmSync(cacheDir, { force: true });
            console.log('🧹 Cleared debugger CDK cache, will recompile for fresh Lambda names');
          }
        } catch (error) {
          // Ignore cache clearing errors
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
        
        resolve();
      }, 2000);
    });
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
  
  return Promise.resolve();
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
    await new Promise(resolve => setTimeout(resolve, 20000));
    
    // Now wait for CloudFormation stack to stabilize
    // This is deterministic - it waits for any deployment to complete
    await waitForStackStable(STACK_NAME, 180);
    
    // Verify that all Lambda functions actually exist and are accessible
    // This prevents the debugger from trying to connect to non-existent Lambdas
    // Also ensures functions are recent (within 5 minutes) to catch name changes
    await verifyLambdasExist(STACK_NAME, 120);
    
    // Additional buffer for Lambda functions to be fully ready
    // Lambda functions need a moment after CloudFormation completes
    // Also gives time for Lambda Live Debugger's CDK compilation cache to refresh
    console.log('⏳ Waiting 20 seconds for Lambda functions and debugger cache to be ready...');
    await new Promise(resolve => setTimeout(resolve, 20000));
    
    // Restart Lambda Live Debugger
    // This will trigger a fresh CDK compilation, getting current Lambda names
    console.log('🔄 Restarting Lambda Live Debugger (will recompile CDK for fresh Lambda names)...\n');
    await startLldebugger();
    
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
  // in dist/lambda and deploys them via full CloudFormation.
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
console.log('🚀 Starting unified development environment (full CloudFormation deployments)...\n');
console.log('   This will:');
console.log('   1. Start Lambda build watcher (rebuilds Lambda code on changes)');
console.log('   2. Start CDK watch (full CloudFormation deployments - no hotswap)');
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
  
  // Start CDK watch (watches dist/lambda and deploys via CloudFormation)
  setTimeout(() => {
    startCdkWatch();
  }, 2000);
  
  // Wait for initial stack check, then start LLD
  setTimeout(async () => {
    // Check if stack exists and is stable before starting LLD
    await waitForStackStable(STACK_NAME, 30);
    
    // Verify Lambda functions exist before starting debugger
    await verifyLambdasExist(STACK_NAME, 60);
    
    console.log('⏳ Waiting 5 seconds before starting debugger...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    await startLldebugger();
  }, 5000);
});

