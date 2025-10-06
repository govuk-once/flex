/* eslint-disable @typescript-eslint/no-unused-vars */
import { getProjects, joinPathFragments, Tree } from '@nx/devkit';

export default function update(host: Tree) {
  console.log("Updating license.txt files for all projects");
  const projects = getProjects(host);

  for (const [name, project] of projects) {
    host.write(
      joinPathFragments(project.root, 'license.txt'),
      `${name} uses the GNU license.`
    )
  }

  return {
    outOfSyncMessage: 'Some projects are missing a license.txt file.',
  };
}
