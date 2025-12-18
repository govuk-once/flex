# Flex Infrastructure

CDK infrastructure for Flex API with Lambda Live Debugging and Hot Module Reloading.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Bootstrap CDK (first time only):
   ```bash
   npm run bootstrap
   ```

## Development

### Unified Development Environment (Recommended)

**With Hotswap (Fast - recommended for code changes):**
```bash
npm run dev:unified
```

**Without Hotswap (Full CloudFormation - for infrastructure changes):**
```bash
npm run dev:unified:no-hotswap
```

Both unified CLIs:
1. ✅ Start Lambda build watcher (rebuilds Lambda code on changes)
2. ✅ Start CDK watch (with or without hotswap)
3. ✅ Start Lambda Live Debugger
4. ✅ Watch for stack file changes
5. ✅ Coordinate timing - wait for CloudFormation to complete before restarting LLD
6. ✅ Handle deleted Lambdas gracefully

**Difference:**
- `dev:unified` - Uses `cdk watch --hotswap` for fast code updates (~10-30 seconds)
- `dev:unified:no-hotswap` - Uses `cdk watch` for full CloudFormation deployments (slower but more reliable for infrastructure changes)

**How it works:**
- When you change Lambda code → CDK watch hotswaps it automatically
- When you change stack files → Waits for CloudFormation to stabilize → Restarts LLD
- No timing issues - LLD only restarts after Lambdas are fully ready

**Using the Debugger:**

1. Start unified dev: `npm run dev:unified`
2. In VS Code, attach the debugger (F5 → "Attach to Lambda Live Debugger")
3. Set breakpoints in your Lambda handler (e.g., `lambda/hello/handler.ts`)
4. Invoke your Lambda via API Gateway or AWS Console

### Individual Tools

**Lambda Live Debugger Only:**
```bash
npm run lldebugger:watch  # With file watcher
npm run lldebugger        # Manual start
```

**CDK Watch Only:**
```bash
npm run watch:all:hotswap  # With Lambda build watcher
npm run watch              # CDK watch only
```

### Hot Module Reloading with CDK Watch

CDK Watch automatically rebuilds and hotswaps Lambda code when you make changes:

**⚠️ Important**: `cdk watch --hotswap` only hotswaps **existing** resources. If you add a **new** Lambda function, you need to do a full deploy first:
```bash
npm run deploy
```

After the new Lambda is created, `cdk watch` will hotswap its code changes.

**Option 1: Single Command (Recommended)**
```bash
npm run watch:all
```

This runs:
- Lambda build watcher (rebuilds Lambda code on changes)
- CDK watch (detects changes and hotswaps existing resources)

**Option 2: Separate Terminals**
```bash
# Terminal 1: Watch Lambda code
npm run build:lambda:watch

# Terminal 2: Watch and hotswap
npm run watch
```

### How It Works

1. **Lambda Build Watcher**: `esbuild` watches `lambda/**/*.ts` files
2. When you save changes, `esbuild` rebuilds to `dist/lambda/`
3. **CDK Watch** detects changes in `dist/lambda/` (via asset hash)
4. CDK automatically hotswaps the Lambda function code
5. Your changes are live in ~10-30 seconds!

## Deployment

```bash
# Deploy stack
npm run deploy

# Deploy with hotswap (faster, no CloudFormation changes)
npm run deploy:hotswap
```

## Testing

```bash
npm test
```

## Stack Outputs

After deployment, get the API URL:
```bash
aws cloudformation describe-stacks \
  --stack-name FlexApiStack \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text
```

