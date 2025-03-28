// clean up logs every week so that the logs directory does not grow too much

Features to be added:

1. **Disk Metrics** (done - jc)

   - Disk usage/space
   - Disk I/O operations
   - Read/Write speeds
   - IOPS (Input/Output Operations Per Second)
   - Found in todo.md where disk monitoring is planned with a 90% threshold

2. **Network Metrics** (done - knowledge)

   - Network bandwidth usage
   - Network latency
   - Packet loss
   - Network interface statistics
   - Connection counts

3. **Process Metrics** (done - jc)

   - Top processes by CPU usage
   - Top processes by memory usage
   - Process count
   - Zombie processes
   - Process states

4. **System Load Metrics**

   - While basic CPU load is implemented, more detailed metrics could include:
   - Process queue length
   - Context switches
   - System interrupts
   - Detailed load analysis

5. **Memory Metrics Extensions** (done)

   - While basic memory usage is implemented, could add:
   - Swap usage
   - Page faults
   - Buffer/cache usage
   - Memory pressure statistics
   - custom threshold settings for memory usage

6. **File System Metrics**

   - File system usage by mount point
   - Inode usage
   - File system types and states
   - Mount point statistics

7. **System Services**

   - Service status monitoring
   - Service uptime
   - Service resource usage
   - Service dependencies

8. **Log Monitoring**

   - System log analysis
   - Error log monitoring
   - Custom log file monitoring
   - Log pattern matching

9. **Security Metrics**

   - Failed login attempts
   - SSH access logs
   - Firewall statistics
   - Port scanning detection

10. **Database Metrics** (if databases are running)

    - Connection pool stats
    - Query performance
    - Database size
    - Transaction rates

11. **Container Metrics**

    - Docker container stats
    - Container resource usage
    - Container health checks
    - Container logs

12. **Custom Metrics**

    - User-defined metrics
    - Application-specific metrics
    - Custom threshold settings
    - Custom alert rules

13. **Historical Data**

    - Metric history storage
    - Trend analysis
    - Performance baselines
    - Historical comparisons
