"""
Resource monitoring utilities for capacity management
"""
import logging
import psutil
import os
from typing import Dict, Any, Optional

logger = logging.getLogger("dex-core")

class ResourceMonitor:
    """Monitor system resources for capacity management"""
    
    @staticmethod
    def get_memory_usage() -> Dict[str, Any]:
        """Get current memory usage statistics"""
        try:
            process = psutil.Process(os.getpid())
            memory_info = process.memory_info()
            system_memory = psutil.virtual_memory()
            
            return {
                "process_memory_mb": memory_info.rss / (1024 * 1024),
                "process_memory_percent": process.memory_percent(),
                "system_total_gb": system_memory.total / (1024 * 1024 * 1024),
                "system_available_gb": system_memory.available / (1024 * 1024 * 1024),
                "system_used_percent": system_memory.percent,
            }
        except Exception as e:
            logger.warning(f"Failed to get memory usage: {e}")
            return {}
    
    @staticmethod
    def get_cpu_usage() -> Dict[str, Any]:
        """Get current CPU usage statistics"""
        try:
            process = psutil.Process(os.getpid())
            cpu_percent = process.cpu_percent(interval=0.1)
            system_cpu = psutil.cpu_percent(interval=0.1)
            cpu_count = psutil.cpu_count()
            
            return {
                "process_cpu_percent": cpu_percent,
                "system_cpu_percent": system_cpu,
                "cpu_count": cpu_count,
            }
        except Exception as e:
            logger.warning(f"Failed to get CPU usage: {e}")
            return {}
    
    @staticmethod
    def get_resource_summary() -> Dict[str, Any]:
        """Get comprehensive resource summary"""
        memory = ResourceMonitor.get_memory_usage()
        cpu = ResourceMonitor.get_cpu_usage()
        
        return {
            "memory": memory,
            "cpu": cpu,
            "timestamp": psutil.boot_time() if hasattr(psutil, 'boot_time') else None,
        }
    
    @staticmethod
    def check_capacity_available() -> Dict[str, Any]:
        """Check if system has capacity for additional ingestion sessions"""
        memory = ResourceMonitor.get_memory_usage()
        cpu = ResourceMonitor.get_cpu_usage()
        
        # Estimate capacity based on current usage
        # Assume each ingestion needs ~300MB memory and 1-2% CPU
        process_memory_mb = memory.get("process_memory_mb", 0)
        system_available_gb = memory.get("system_available_gb", 0)
        system_cpu_percent = cpu.get("system_cpu_percent", 0)
        
        # Estimate available capacity
        # Conservative: Leave 20% headroom
        available_memory_gb = system_available_gb * 0.8
        estimated_sessions_by_memory = int((available_memory_gb * 1024) / 300)  # 300MB per session
        
        # CPU: Assume 80% max usage, each session uses 1-2%
        available_cpu_percent = 80 - system_cpu_percent
        estimated_sessions_by_cpu = int(available_cpu_percent / 2)  # 2% per session
        
        # Take minimum of both constraints
        estimated_capacity = min(estimated_sessions_by_memory, estimated_sessions_by_cpu)
        
        return {
            "estimated_capacity": max(0, estimated_capacity),
            "memory_constraint": estimated_sessions_by_memory,
            "cpu_constraint": estimated_sessions_by_cpu,
            "current_memory_mb": process_memory_mb,
            "available_memory_gb": system_available_gb,
            "cpu_usage_percent": system_cpu_percent,
        }
