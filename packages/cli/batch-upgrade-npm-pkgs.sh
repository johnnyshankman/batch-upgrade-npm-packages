#!/bin/bash

# ====================================================================================================
# UPGRADE-PKGS - Npm Package Upgrader for Multiple Repositories
# ====================================================================================================
#
# DESCRIPTION:
#   This script automates the process of updating npm packages across multiple repositories.
#   It ensures all git operations are performed safely, by:
#     - Working from the latest version of the main branch
#     - Creating a new branch for changes
#     - Never committing directly to main
#     - Creating pull requests for each repository
#
# REQUIREMENTS:
#   - Git
#   - GitHub CLI (gh) - Must be authenticated before running
#   - npm
#   - jq (recommended for reliable package.json parsing)
#   - semver (npm package, used for version comparison if available)
#
# USAGE:
#   chmod +x upgrade-pkgs.sh
#   ./upgrade-pkgs.sh
#
# INTERACTIVE INPUTS:
#   1. Packages to update (space-separated)
#      Example: @coolteam/pkg1 leftpad
#
#   2. Version ranges (space-separated, matching package order)
#      Example: ^1.0.0 ^2.2.1
#
#   3. Repository paths (space-separated, relative to current directory)
#      Example: some-cool-repo my-cool-other-repo
#
# BEHAVIOR:
#   For each repository, the script will:
#     1. Check out the main branch and pull latest changes
#     2. Create a new branch for package updates
#     3. Update the specified packages to their target versions
#        a. Skip packages not found in the repository
#        b. Skip packages already at or above the requested version
#     4. Verify installations using:
#        a. Remove node_modules directory for a clean environment
#        b. First attempt with 'npm install --force'
#        c. Remove node_modules again
#        d. Second verification with regular 'npm install'
#     5. Commit changes if any updates were made
#     6. Push the branch to origin
#     7. Create a pull request with details of the updates (only if changes were made)
#
# SAFETY FEATURES:
#   - Will not commit directly to main branch
#   - Discards any uncommitted changes in repositories
#   - Validates GitHub CLI authentication before proceeding
#   - Creates descriptive pull requests for review before merging
#   - Cleans up branches if no changes were made
#   - Double verification of package installations
#   - Clean node_modules removal before installations
#   - Skips updating packages that are already up-to-date
#   - Skips creating PRs when no changes were made
#
# EXAMPLE WORKFLOW:
#   $ ./upgrade-pkgs.sh
#   Enter packages to update (space-separated): @coolteam/pkg1 @otherteam/pkg2 leftpad
#   Enter version ranges (space-separated, matching the order of packages): ^1.0.0 ^2.2.1 ^3.0.0
#   Enter repository paths (space-separated): some-cool-repo my-cool-other-repo
#
# ====================================================================================================

set -e

# Function to check if the gh CLI is logged in
check_gh_login() {
  echo "Checking if you're logged into GitHub CLI..."
  if ! gh auth status &>/dev/null; then
    echo "Error: You are not logged into GitHub CLI. Please run 'gh auth login' first."
    exit 1
  fi
  echo "GitHub CLI authentication confirmed."
}

# Function to check if a package exists in package.json
package_exists() {
  local pkg=$1
  if [ ! -f "package.json" ]; then
    return 1
  fi

  grep -q "\"$pkg\"" package.json
  return $?
}

# Function to find the current version of a package
get_current_version() {
  local pkg=$1
  local section=$2

  if command -v jq >/dev/null 2>&1; then
    jq -r ".$section.\"$pkg\" // empty" package.json
  else
    # Fallback to grep and sed if jq is not available
    grep -A 1 "\"$section\".*\"$pkg\"" package.json | tail -n 1 | sed -E 's/.*"[^"]*"[^"]*"([^"]*).*/\1/'
  fi
}

# Function to compare versions - returns 0 if current version is >= target version
# This is a simplified version comparison that handles basic semver
version_is_higher_or_equal() {
  local current=$1
  local target=$2

  # Remove any caret, tilde or equals prefix from versions for comparison
  current=${current#^}
  current=${current#~}
  current=${current#=}
  target=${target#^}
  target=${target#~}
  target=${target#=}

  # Check if semver is available (much more reliable)
  if command -v npx >/dev/null 2>&1 && npx --no-install semver --version >/dev/null 2>&1; then
    # Use semver to compare versions
    if npx --no-install semver --range ">=$target" "$current" >/dev/null 2>&1; then
      return 0
    else
      return 1
    fi
  else
    # Fallback to basic version comparison (less reliable)
    echo "Warning: semver not available, using simplified version comparison"

    # Split versions by dots
    IFS='.' read -ra CURRENT_PARTS <<< "$current"
    IFS='.' read -ra TARGET_PARTS <<< "$target"

    # Compare major version
    if [ "${CURRENT_PARTS[0]}" -gt "${TARGET_PARTS[0]}" ]; then
      return 0
    elif [ "${CURRENT_PARTS[0]}" -lt "${TARGET_PARTS[0]}" ]; then
      return 1
    fi

    # Compare minor version if available
    if [ ${#CURRENT_PARTS[@]} -gt 1 ] && [ ${#TARGET_PARTS[@]} -gt 1 ]; then
      if [ "${CURRENT_PARTS[1]}" -gt "${TARGET_PARTS[1]}" ]; then
        return 0
      elif [ "${CURRENT_PARTS[1]}" -lt "${TARGET_PARTS[1]}" ]; then
        return 1
      fi
    fi

    # Compare patch version if available
    if [ ${#CURRENT_PARTS[@]} -gt 2 ] && [ ${#TARGET_PARTS[@]} -gt 2 ]; then
      if [ "${CURRENT_PARTS[2]}" -gt "${TARGET_PARTS[2]}" ]; then
        return 0
      elif [ "${CURRENT_PARTS[2]}" -lt "${TARGET_PARTS[2]}" ]; then
        return 1
      fi
    fi

    # Versions are equal up to the available parts
    return 0
  fi
}

# Function to handle a specific repository
update_repo() {
  local repo_path=$1
  local packages=("${!2}")
  local versions=("${!3}")
  local branch_name=$4
  local pr_title=$5
  local pr_body=$6

  echo "-------------------------------------"
  echo "Processing repository: $repo_path"

  # Navigate to the repository
  cd "$repo_path" || { echo "Error: Could not navigate to $repo_path"; return 1; }

  # Discard any uncommitted changes
  git reset --hard HEAD

  # Switch to main branch
  echo "Switching to main branch..."
  git checkout main || { echo "Error: Could not switch to main branch in $repo_path"; return 1; }

  # Pull latest changes
  echo "Pulling latest changes from origin/main..."
  git pull origin main || { echo "Error: Could not pull latest changes in $repo_path"; return 1; }

  # Create and switch to a new branch
  echo "Creating and switching to new branch: $branch_name..."
  git checkout -b "$branch_name" || { echo "Error: Could not create new branch in $repo_path"; return 1; }

  # Update each package
  echo "Checking packages:"
  local update_success=false
  local updated_packages=()
  local updated_versions=()

  # If package.json exists, update it directly
  if [ -f "package.json" ]; then
    # Create a backup of package.json
    cp package.json package.json.bak

    # Update each package version directly in package.json
    # This approach is more efficient than running npm install for each package
    echo "Analyzing package versions in package.json..."
    for i in "${!packages[@]}"; do
      local pkg="${packages[$i]}"
      local ver="${versions[$i]}"

      # Skip packages that don't exist in package.json
      if ! package_exists "$pkg"; then
        echo "  - Skipping $pkg: Not found in package.json"
        continue
      fi

      # Check current version in different dependency sections
      local current_version=""
      local package_section=""

      for section in dependencies devDependencies peerDependencies; do
        if command -v jq >/dev/null 2>&1; then
          # Try to get version from each section using jq
          if current=$(jq -r ".$section.\"$pkg\" // empty" package.json) && [ -n "$current" ]; then
            current_version="$current"
            package_section="$section"
            break
          fi
        else
          # Fallback to grep and sed if jq is not available
          if grep -q "\"$section\".*\"$pkg\"" package.json; then
            current_version=$(get_current_version "$pkg" "$section")
            package_section="$section"
            break
          fi
        fi
      done

      # Skip if we couldn't determine the current version
      if [ -z "$current_version" ]; then
        echo "  - Warning: Could not determine current version of $pkg"
        continue
      fi

      # Compare versions and skip if current is >= target
      if version_is_higher_or_equal "$current_version" "$ver"; then
        echo "  - Skipping $pkg: Current version $current_version is already >= $ver"
        continue
      fi

      echo "  - Updating $pkg from $current_version to $ver in $package_section section"

      # Add to our list of packages that will be updated
      updated_packages+=("$pkg")
      updated_versions+=("$ver")

      # Update the package version
      if command -v jq >/dev/null 2>&1; then
        # Update using jq
        jq --indent 2 "if .$package_section.\"$pkg\" != null then .$package_section.\"$pkg\" = \"$ver\" else . end" package.json > package.json.tmp && mv package.json.tmp package.json
        update_success=true
      else
        # Fallback to sed
        echo "jq not available, using sed for package.json updates (less reliable)"
        # Try to update in the specific section
        sed -i.tmp -E "s/(\"$package_section\"[^}]*\"$pkg\"[[:space:]]*:[[:space:]]*\")[^\"]*(\",?)/\1$ver\2/" package.json
        if ! diff -q package.json package.json.tmp >/dev/null 2>&1; then
          rm -f package.json.tmp
          update_success=true
        else
          rm -f package.json.tmp
          echo "  - Warning: Could not update $pkg using sed"
        fi
      fi
    done

    # Remove temporary files created by sed
    rm -f package.json.tmp package.json.original

    # If no updates were made, restore the backup
    if [ "$update_success" = false ]; then
      mv package.json.bak package.json
      echo "No packages were updated in package.json"
    else
      rm -f package.json.bak
    fi
  fi

  # Verify installation with --force followed by regular install
  if [ "$update_success" = true ]; then
    echo "Removing node_modules directory for clean installation..."
    rm -rf node_modules/

    # First run with --force to update package-lock.json and dependencies
    # This ensures all package versions are resolved correctly
    echo "Updating package-lock.json and verifying installation with npm install --force..."
    if ! npm install --force; then
      echo "Error: Force installation failed in $repo_path"
      return 1
    fi

    echo "Removing node_modules directory again before verification..."
    rm -rf node_modules/

    # Second run without --force for final verification
    # This ensures the project can be built normally without force flags
    echo "Verifying package installation with regular npm install..."
    if ! npm install; then
      echo "Error: Regular installation failed after forced install in $repo_path"
      return 1
    fi

    echo "Package installation verified successfully."
  fi

  # Check if there are changes to commit
  if ! git diff --quiet package.json package-lock.json; then
    echo "Changes detected. Committing and pushing..."

    # Update PR title and body to only include packages that were actually updated
    local updated_package_list=""
    local updated_pr_body="This PR updates the following npm packages:

"

    for i in "${!updated_packages[@]}"; do
      if [ $i -gt 0 ]; then
        updated_package_list+=", "
      fi
      updated_package_list+="${updated_packages[$i]}@${updated_versions[$i]}"
      updated_pr_body+="- ${updated_packages[$i]} to ${updated_versions[$i]}
"
    done

    updated_pr_body+="
Automatically generated by [batch-upgrade-npm-packages](https://www.npmjs.com/package/batch-upgrade-npm-packages)."

    # Use the updated title if we have updated packages
    if [ -n "$updated_package_list" ]; then
      pr_title="Update npm packages: $updated_package_list"
      pr_body="$updated_pr_body"
    fi

    git add package.json package-lock.json
    git commit -m "$pr_title"

    # Push the changes
    git push --set-upstream origin "$branch_name" || { echo "Error: Could not push changes for $repo_path"; return 1; }

    # Create a PR
    echo "Creating pull request..."
    gh pr create --title "$pr_title" --body "$pr_body" --base main || { echo "Error: Could not create PR for $repo_path"; return 1; }

    echo "Pull request created successfully for $repo_path"
  else
    echo "No changes detected in package.json or package-lock.json. Skipping PR creation."
    # Clean up the branch since we didn't make any changes
    git checkout main
    git branch -D "$branch_name"
  fi

  # Return to the original directory
  cd - >/dev/null
  echo "Completed processing $repo_path"
}

# Main script execution
main() {
  # Check that gh CLI is logged in
  check_gh_login

  # Define the packages to update
  # Example: packages=("@manifoldxyz/pkg1" "@manifoldxyz/pkg2")
  read -p "Enter packages to update (space-separated): " -a input_packages

  # Define the version ranges
  # Example: versions=("^1.0.0" "^2.2.1")
  read -p "Enter version ranges (space-separated, matching the order of packages): " -a input_versions

  # Validate input
  if [ ${#input_packages[@]} -ne ${#input_versions[@]} ]; then
    echo "Error: Number of packages and versions must match."
    exit 1
  fi

  if [ ${#input_packages[@]} -eq 0 ]; then
    echo "Error: No packages specified."
    exit 1
  fi

  # Define the repositories to update
  # Example: repos=("studio-apps-r2" "my-cool-other-repo")
  read -p "Enter repository paths (space-separated): " -a input_repos

  if [ ${#input_repos[@]} -eq 0 ]; then
    echo "Error: No repositories specified."
    exit 1
  fi

  # Generate a timestamp for branch names
  timestamp=$(date +"%Y%m%d%H%M%S")

  # Create PR title and description
  package_list=""
  for i in "${!input_packages[@]}"; do
    if [ $i -gt 0 ]; then
      package_list+=", "
    fi
    package_list+="${input_packages[$i]}@${input_versions[$i]}"
  done

  pr_title="Update npm packages: $package_list"

  # Create PR body with proper newlines
  pr_body="This PR updates the following npm packages:

"
  for i in "${!input_packages[@]}"; do
    pr_body+="- ${input_packages[$i]} to ${input_versions[$i]}
"
  done
  pr_body+="
Automatically generated by [batch-upgrade-npm-packages](https://www.npmjs.com/package/batch-upgrade-npm-packages)."

  # Process each repository
  for repo in "${input_repos[@]}"; do
    # Create a unique branch name
    branch_name="update-packages-$timestamp"

    # Update the repository
    update_repo "$repo" input_packages[@] input_versions[@] "$branch_name" "$pr_title" "$pr_body"
  done

  echo "-------------------------------------"
  echo "Package update process completed."
}

# Execute the main function
main "$@"
