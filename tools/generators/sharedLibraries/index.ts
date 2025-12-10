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
      name: `@flex/${projectName}`,
      $schema: '../../node_modules/nx/schemas/project-schema.json',
      sourceRoot: `${projectRoot}/src`,
      projectType: 'library',
      targets: {
        lint: {
          executor: '@nx/eslint:lint',
          options: {
            lintFilePatterns: [`${projectRoot}/src/**/*.ts`],
          },
        },
        test: {
          executor: 'nx:run-commands',
          options: {
            command: `vitest run ${projectRoot}/src/ --passWithNoTests`,
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
