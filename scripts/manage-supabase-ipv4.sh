#!/bin/bash

# Supabase IPv4 Add-on Management Script
# This script helps manage the IPv4 add-on for your Supabase project

# Configuration
SUPABASE_ACCESS_TOKEN="sbp_dda610bf0a8e5fe2782b093b069919719edbddc4"
PROJECT_REF="zyrxhllgdgowsbjislaq"  # Extracted from db.zyrxhllgdgowsbjislaq.supabase.co

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Supabase IPv4 Add-on Manager${NC}"
echo "Project Ref: $PROJECT_REF"
echo ""

# Function to check current add-on status
check_status() {
    echo -e "${YELLOW}Checking current IPv4 add-on status...${NC}"
    response=$(curl -s -X GET "https://api.supabase.com/v1/projects/$PROJECT_REF/billing/addons" \
        -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN")
    
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    
    # Check if IPv4 add-on exists
    if echo "$response" | grep -q "ipv4"; then
        echo -e "${GREEN}✓ IPv4 add-on is enabled${NC}"
    else
        echo -e "${RED}✗ IPv4 add-on is not enabled${NC}"
    fi
}

# Function to enable IPv4 add-on
enable_ipv4() {
    echo -e "${YELLOW}Enabling IPv4 add-on...${NC}"
    response=$(curl -s -X POST "https://api.supabase.com/v1/projects/$PROJECT_REF/addons" \
        -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "addon_type": "ipv4"
        }')
    
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    
    if echo "$response" | grep -q "error"; then
        echo -e "${RED}✗ Failed to enable IPv4 add-on${NC}"
        echo "Error details: $response"
    else
        echo -e "${GREEN}✓ IPv4 add-on enabled successfully${NC}"
    fi
}

# Function to disable IPv4 add-on
disable_ipv4() {
    echo -e "${YELLOW}Disabling IPv4 add-on...${NC}"
    response=$(curl -s -X DELETE "https://api.supabase.com/v1/projects/$PROJECT_REF/billing/addons/ipv4" \
        -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN")
    
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ IPv4 add-on disabled successfully${NC}"
    else
        echo -e "${RED}✗ Failed to disable IPv4 add-on${NC}"
    fi
}

# Main menu
case "$1" in
    status|check)
        check_status
        ;;
    enable)
        enable_ipv4
        ;;
    disable)
        disable_ipv4
        ;;
    *)
        echo "Usage: $0 {status|enable|disable}"
        echo ""
        echo "Commands:"
        echo "  status  - Check current IPv4 add-on status"
        echo "  enable  - Enable IPv4 add-on for your project"
        echo "  disable - Disable IPv4 add-on for your project"
        echo ""
        echo "Example:"
        echo "  $0 status   # Check if IPv4 is enabled"
        echo "  $0 enable  # Enable IPv4 add-on"
        exit 1
        ;;
esac
