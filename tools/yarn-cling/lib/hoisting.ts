import { PackageLockPackage } from './types';

/**
 * Hoist package-lock dependencies in-place
 */
export function hoistDependencies(packageLockDeps: Record<string, PackageLockPackage>) {
  let didChange;
  do {
    didChange = false;
    simplify(packageLockDeps);
  } while (didChange);

  // For each of the deps, move each dependency that has the same version into the current array
  function simplify(dependencies: Record<string, PackageLockPackage>) {
    for (const depPackage of Object.values(dependencies)) {
      moveChildrenUp(depPackage, dependencies);
    }
    return dependencies;
  }

  // Move the children of the parent onto the same level if there are no conflicts
  function moveChildrenUp(parent: PackageLockPackage, parentContainer: Record<string, PackageLockPackage>) {
    if (!parent.dependencies) { return; }

    // Then push packages from the mutable parent into ITS parent
    for (const [depName, depPackage] of Object.entries(parent.dependencies)) {
      if (!parentContainer[depName]) {
        // It's new, we can move it up.
        parentContainer[depName] = depPackage;
        delete parent.dependencies[depName];
        didChange = true;

        // Recurse on the package we just moved
        moveChildrenUp(depPackage, parentContainer);
      } else if (parentContainer[depName].version === depPackage.version) {
        // Already exists, no conflict, delete the child, no need to recurse
        delete parent.dependencies[depName];
        didChange = true;
      } else {
        // There is a conflict, leave the second package where it is, but do recurse.
        moveChildrenUp(depPackage, parent.dependencies);
      }
    }

    // Cleanup for nice printing
    if (Object.keys(parent.dependencies).length === 0) {
      delete parent.dependencies;
      didChange = true;
    }
  }
}
