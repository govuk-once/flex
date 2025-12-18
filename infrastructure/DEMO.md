# Demo Guide: Lambda Live Debugging + Hot Module Reloading

## Prerequisites

1. Stack deployed:
   ```bash
   npm run deploy
   ```

2. Get your API URL:
   ```bash
   aws cloudformation describe-stacks \
     --stack-name FlexApiStack \
     --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
     --output text
   ```

## Demo 1: Lambda Live Debugging

### Setup

1. Start Lambda Live Debugger:
   ```bash
   npx lambda-live-debugger
   ```

2. In VS Code:
   - Open `lambda/hello/handler.ts`
   - Set a breakpoint (e.g., line 17)
   - Press F5 → Select "Attach to Lambda Live Debugger"

3. Invoke your Lambda:
   ```bash
   curl <YOUR_API_URL>/hello
   ```

4. **Breakpoint should hit!** You can now:
   - Inspect variables
   - Step through code
   - Evaluate expressions

## Demo 2: Hot Module Reloading with CDK Watch

### Setup

1. Start CDK Watch with Lambda rebuild:
   ```bash
   npm run watch:all
   ```

   This runs:
   - Lambda build watcher (rebuilds on source changes)
   - CDK watch (hotswaps on code changes)

### Demo Steps

1. **Make a change** to `lambda/hello/handler.ts`:
   ```typescript
   body: JSON.stringify({
     message: 'Hello world from Lambda! 🚀', // Add emoji
     method,
     path,
     timestamp: new Date().toISOString(),
     environment: process.env.NODE_ENV || 'development',
   }),
   ```

2. **Save the file**

3. **Watch the magic happen:**
   - `esbuild` detects change → rebuilds to `dist/lambda/`
   - `cdk watch` detects change → hotswaps Lambda code
   - Takes ~10-30 seconds

4. **Test immediately:**
   ```bash
   curl <YOUR_API_URL>/hello
   ```
   
   Your changes are live! No manual deploy needed.

## Combined Demo: Debug + Hot Reload

1. **Terminal 1**: Start Lambda Live Debugger
   ```bash
   npx lambda-live-debugger
   ```

2. **Terminal 2**: Start CDK Watch
   ```bash
   npm run watch:all
   ```

3. **VS Code**: Attach debugger (F5)

4. **Edit code** in `lambda/hello/handler.ts`

5. **Save** → Code rebuilds and hotswaps automatically

6. **Invoke Lambda** → Breakpoints work with new code!

## Tips

- **CDK Watch** only hotswaps code changes, not infrastructure changes
- **Lambda Live Debugger** works with any Lambda in your stack
- Changes take ~10-30 seconds to propagate
- Check CloudWatch logs if something doesn't work

