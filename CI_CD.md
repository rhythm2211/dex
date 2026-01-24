# CI/CD Documentation

This document describes the Continuous Integration and Continuous Deployment (CI/CD) setup for DEX.

## Overview

DEX uses GitHub Actions for CI/CD, providing automated testing, building, and deployment workflows.

## Workflows

### 1. Continuous Integration (CI)

**File**: `.github/workflows/ci.yml`

Runs on every push and pull request to main/dev branches.

**What it does:**
- Lints backend code (Python)
- Lints frontend code (TypeScript/JavaScript)
- Runs backend tests with PostgreSQL
- Builds frontend to verify compilation
- Tests Docker image builds
- Scans for security vulnerabilities

**Duration**: ~10-15 minutes

### 2. Docker Build and Push

**File**: `.github/workflows/docker-build-push.yml`

Builds and pushes Docker images to GitHub Container Registry.

**Triggers:**
- Push to main/dev branches
- Tag creation (v*.*.*)
- Manual workflow dispatch

**What it does:**
- Builds backend Docker image
- Builds frontend Docker image
- Pushes to `ghcr.io/<org>/dex-backend` and `ghcr.io/<org>/dex-frontend`
- Generates Software Bill of Materials (SBOM)
- Supports multi-platform builds (amd64, arm64)

**Image Tags:**
- `latest`: Latest from main branch
- `dev`: Latest from dev branch
- `v1.0.0`: Semantic version tags
- `main-<sha>`: Commit SHA tags

### 3. Deployment

**File**: `.github/workflows/deploy.yml`

Deploys application to staging and production environments.

**Environments:**
- **Staging**: Auto-deploys on push to `dev` branch
- **Production**: Auto-deploys on push to `main` or tag creation
- **Kubernetes**: Optional Kubernetes deployment

**What it does:**
- Pulls latest Docker images
- Deploys using docker-compose
- Runs health checks
- Sends notifications (optional)

### 4. Release

**File**: `.github/workflows/release.yml`

Creates GitHub releases when version tags are pushed.

**What it does:**
- Generates changelog from git commits
- Creates GitHub release
- Includes Docker image tags in release notes

## Setup Instructions

### 1. Configure GitHub Secrets

Go to your repository → Settings → Secrets and variables → Actions

**Required Secrets:**

```bash
# Staging Environment
STAGING_HOST=staging.example.com
STAGING_USER=deploy
STAGING_SSH_KEY=<private-key>
STAGING_URL=https://staging.example.com

# Production Environment
PRODUCTION_HOST=production.example.com
PRODUCTION_USER=deploy
PRODUCTION_SSH_KEY=<private-key>
PRODUCTION_URL=https://example.com

# Optional
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
KUBECONFIG_DATA=<base64-encoded-kubeconfig>
```

### 2. Configure Environments

Go to Settings → Environments

Create environments:
- `staging`: For staging deployments
- `production`: For production deployments

Add environment-specific secrets if needed.

### 3. Enable GitHub Container Registry

1. Go to repository Settings → Actions → General
2. Enable "Read and write permissions" for GITHUB_TOKEN
3. Enable "Allow GitHub Actions to create and approve pull requests"

### 4. Set Up Deployment Server

**On your deployment server:**

```bash
# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Create deployment directory
sudo mkdir -p /opt/dex
cd /opt/dex

# Copy docker-compose.yml
sudo cp /path/to/docker-compose.yml .

# Create .env file
sudo nano .env
# Add your production environment variables

# Set up SSH access
# Generate SSH key pair
ssh-keygen -t ed25519 -C "github-actions"
# Add public key to authorized_keys
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
# Copy private key to GitHub Secrets
cat ~/.ssh/id_ed25519
```

## Usage

### Running CI Locally

**Backend:**
```bash
cd app
pip install -r requirements.txt
pip install flake8 black isort pytest pytest-cov
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
npm test
```

### Manual Deployment

1. Go to Actions tab
2. Select "Deploy" workflow
3. Click "Run workflow"
4. Choose:
   - Environment: staging or production
   - Tag: Docker image tag (optional)
5. Click "Run workflow"

### Creating a Release

```bash
# Create annotated tag
git tag -a v1.0.0 -m "Release version 1.0.0"

# Push tag
git push origin v1.0.0
```

This automatically:
1. Builds and pushes Docker images
2. Creates GitHub release
3. Deploys to production

### Viewing Workflow Status

- **GitHub UI**: Go to Actions tab
- **Badges**: Add to README.md:
  ```markdown
  ![CI](https://github.com/your-org/dex/workflows/CI/badge.svg)
  ```

## Workflow Details

### CI Workflow

```yaml
# Runs on push/PR
on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main, dev]

# Jobs run in parallel
jobs:
  - backend-lint
  - backend-test
  - frontend-lint
  - frontend-build
  - docker-build
  - security-scan
```

### Docker Build Workflow

```yaml
# Builds for multiple platforms
platforms: linux/amd64,linux/arm64

# Caching for faster builds
cache-from: type=gha
cache-to: type=gha,mode=max
```

### Deployment Workflow

```yaml
# Environment protection
environment:
  name: production
  url: https://example.com

# Health checks
- name: Health check
  run: curl -f ${{ secrets.PRODUCTION_URL }}/health
```

## Best Practices

### 1. Branch Strategy

- `main`: Production-ready code
- `dev`: Development branch
- Feature branches: `feature/*`
- Hotfix branches: `hotfix/*`

### 2. Commit Messages

Follow conventional commits:
```
feat: add new feature
fix: fix bug
docs: update documentation
chore: update dependencies
```

### 3. Pull Requests

- All changes go through PR
- CI must pass before merge
- Require code review
- Use PR template

### 4. Versioning

Use semantic versioning:
- `v1.0.0`: Major release
- `v1.1.0`: Minor release
- `v1.1.1`: Patch release

### 5. Secrets Management

- Never commit secrets
- Use GitHub Secrets
- Rotate regularly
- Use environment-specific secrets

### 6. Monitoring

- Monitor workflow runs
- Set up alerts for failures
- Review deployment logs
- Track deployment frequency

## Troubleshooting

### CI Fails

**Common issues:**
1. **Linting errors**: Fix code style issues
2. **Test failures**: Check test output
3. **Build failures**: Verify dependencies
4. **Timeout**: Increase job timeout

**Solutions:**
```bash
# Run linting locally
cd app && flake8 backend/
cd frontend && npm run lint

# Run tests locally
cd app && pytest backend/tests/
cd frontend && npm test
```

### Deployment Fails

**Common issues:**
1. **SSH connection**: Verify SSH keys
2. **Docker not found**: Install Docker on server
3. **Permission denied**: Check file permissions
4. **Health check fails**: Check service logs

**Solutions:**
```bash
# Test SSH connection
ssh -i ~/.ssh/id_ed25519 user@server

# Check Docker on server
ssh user@server "docker --version"

# Check service logs
ssh user@server "cd /opt/dex && docker compose logs"
```

### Docker Build Fails

**Common issues:**
1. **Dockerfile errors**: Check syntax
2. **Missing dependencies**: Update requirements
3. **Cache issues**: Clear build cache
4. **Platform issues**: Check platform compatibility

**Solutions:**
```bash
# Build locally
docker build -t test-backend -f app/backend/Dockerfile ./app
docker build -t test-frontend -f frontend/Dockerfile ./frontend

# Test images
docker run -p 8000:8000 test-backend
docker run -p 3000:3000 test-frontend
```

## Advanced Configuration

### Custom Workflows

Create custom workflows in `.github/workflows/`:

```yaml
name: Custom Workflow
on:
  workflow_dispatch:
    inputs:
      custom_param:
        description: 'Custom parameter'
        required: true

jobs:
  custom-job:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: echo ${{ inputs.custom_param }}
```

### Matrix Builds

Test against multiple versions:

```yaml
strategy:
  matrix:
    python-version: ['3.10', '3.11', '3.12']
    node-version: ['18', '20', '22']
```

### Conditional Steps

Run steps conditionally:

```yaml
- name: Deploy
  if: github.ref == 'refs/heads/main'
  run: ./deploy.sh
```

## Monitoring and Alerts

### GitHub Actions

- View runs in Actions tab
- Set up email notifications
- Use status badges

### External Monitoring

- Integrate with monitoring tools
- Set up webhooks
- Use deployment tracking

## Security

### Secrets Security

- Never log secrets
- Use environment secrets
- Rotate regularly
- Limit access

### Container Security

- Scan images for vulnerabilities
- Use minimal base images
- Keep dependencies updated
- Sign images (optional)

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Documentation](https://docs.docker.com/)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)

## Support

For CI/CD issues:
1. Check workflow logs
2. Review this documentation
3. Check GitHub Actions status page
4. Open an issue with workflow logs
