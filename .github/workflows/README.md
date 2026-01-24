# CI/CD Workflows

This directory contains GitHub Actions workflows for continuous integration and deployment.

## Workflows

### 1. CI (`ci.yml`)
Runs on every push and pull request to main/dev branches.

**Jobs:**
- **backend-lint**: Lints Python code with flake8, black, and isort
- **backend-test**: Runs backend tests with PostgreSQL service
- **frontend-lint**: Lints TypeScript/JavaScript code with ESLint
- **frontend-build**: Builds Next.js application to verify it compiles
- **docker-build**: Tests Docker image builds
- **security-scan**: Runs Trivy vulnerability scanner

### 2. Docker Build and Push (`docker-build-push.yml`)
Builds and pushes Docker images to GitHub Container Registry.

**Triggers:**
- Push to main/dev branches
- Tag push (v*)
- Manual workflow dispatch

**Features:**
- Multi-platform builds (amd64, arm64)
- Automatic tagging based on branch/version
- Build cache optimization
- SBOM generation

### 3. Deploy (`deploy.yml`)
Deploys application to staging/production environments.

**Environments:**
- **Staging**: Auto-deploys on push to `dev` branch
- **Production**: Auto-deploys on push to `main` or tag creation
- **Kubernetes**: Optional Kubernetes deployment

**Requirements:**
- SSH keys configured in GitHub Secrets
- Server access credentials
- Health check URLs

### 4. Release (`release.yml`)
Creates GitHub releases when tags are pushed.

**Features:**
- Automatic changelog generation
- Release notes with Docker image tags
- Draft/prerelease support

## Required Secrets

### Repository Secrets

#### For Docker Build:
- `GITHUB_TOKEN` (automatically provided)

#### For Deployment:
- `STAGING_HOST`: Staging server hostname/IP
- `STAGING_USER`: SSH username for staging
- `STAGING_SSH_KEY`: SSH private key for staging
- `STAGING_URL`: Staging environment URL
- `PRODUCTION_HOST`: Production server hostname/IP
- `PRODUCTION_USER`: SSH username for production
- `PRODUCTION_SSH_KEY`: SSH private key for production
- `PRODUCTION_URL`: Production environment URL

#### Optional:
- `SLACK_WEBHOOK_URL`: For deployment notifications
- `KUBECONFIG_DATA`: For Kubernetes deployment
- `NEXT_PUBLIC_API_URL`: Frontend API URL override
- `INTERNAL_API_URL`: Internal API URL override
- `NEXTAUTH_URL`: NextAuth URL override

### Environment Secrets

Configure these in GitHub repository settings under Environments:
- `staging`: Staging-specific secrets
- `production`: Production-specific secrets

## Usage

### Running CI Locally

**Backend:**
```bash
cd app
pip install -r requirements.txt
flake8 backend/
black --check backend/
pytest backend/tests/
```

**Frontend:**
```bash
cd frontend
npm install
npm run lint
npm run build
```

### Manual Deployment

1. Go to Actions tab in GitHub
2. Select "Deploy" workflow
3. Click "Run workflow"
4. Choose environment and tag
5. Click "Run workflow"

### Creating a Release

```bash
# Create and push a tag
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

This will automatically:
1. Build and push Docker images
2. Create a GitHub release
3. Deploy to production (if configured)

## Workflow Status Badges

Add to your README.md:

```markdown
![CI](https://github.com/your-org/dex/workflows/CI/badge.svg)
![Docker Build](https://github.com/your-org/dex/workflows/Docker%20Build%20and%20Push/badge.svg)
```

## Troubleshooting

### CI Fails

1. Check workflow logs in Actions tab
2. Verify all dependencies are in requirements.txt/package.json
3. Ensure test database is accessible
4. Check for linting errors

### Deployment Fails

1. Verify SSH keys are correctly configured
2. Check server has Docker installed
3. Verify docker-compose.yml is on server
4. Check server disk space
5. Review deployment logs

### Docker Build Fails

1. Check Dockerfile syntax
2. Verify all dependencies are available
3. Check build cache isn't corrupted
4. Review build logs for specific errors

## Customization

### Adding New Jobs

Edit the workflow files to add:
- Additional test suites
- Code quality checks
- Security scans
- Performance tests

### Changing Deployment Targets

Modify `deploy.yml` to:
- Add new environments
- Change deployment method
- Add pre/post deployment steps

## Best Practices

1. **Never commit secrets**: Always use GitHub Secrets
2. **Test locally first**: Run CI checks before pushing
3. **Review PRs**: All changes go through PR review
4. **Tag releases**: Use semantic versioning (v1.0.0)
5. **Monitor deployments**: Check health after deployment
6. **Rollback plan**: Keep previous Docker images for rollback
