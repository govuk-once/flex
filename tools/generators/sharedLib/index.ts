import { ILibGeneratorSchema } from './schema';
import {
  Tree,
  formatFiles,
  generateFiles,
  joinPathFragments,
} from '@nx/devkit';

export default async function (tree: Tree, schema: ILibGeneratorSchema) {
  const projectName = schema.libName;
  const projectRoot = `libs/${projectName}`;

  // Create project.json file
  tree.write(
    `${projectRoot}/project.json`,
    JSON.stringify({
      name: `@modules/${projectName}`,
      sourceRoot: `${projectRoot}/src`,
      projectType: 'library',
      targets: {
        build: {
          executor: `@nx/esbuild:esbuild`,
          options: {
            outputPath: `dist/${projectRoot}`,
            main: `${projectRoot}/src/index.ts`,
            tsConfig: `${projectRoot}/tsconfig.json`,
          },
        },
        lint: {
          executor: '@nx/eslint:lint',
          options: {
            lintFilePatterns: [`${projectRoot}/**/*.ts`],
          },
        },
        test: {
          executor: '@nx/vite:test',
          options: {
            config: 'vitest.config.ts',
            passWithNoTests: true,
          },
        },
      },
    }),
  );

  generateFiles(tree, joinPathFragments(__dirname, './files'), projectRoot, {
    projectName,
  });

  await formatFiles(tree);
}
