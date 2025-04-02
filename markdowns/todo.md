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

4. **System Load Metrics** (done - victor)

   - While basic CPU load is implemented, more detailed metrics could include:
   - Process queue length
   - Context switches
   - System interrupts
   - Detailed load analysis

5. **Memory Metrics Extensions** (done - jc)

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

7. **System Services** (done - jc)

   - Service status monitoring
   - Service uptime
   - Service resource usage
   - Service dependencies

8. **Log Monitoring**

   - System log analysis
   - Error log monitoring
   - Custom log file monitoring
   - Log pattern matching

9. **Security Metrics** (done - jc)

   - Failed login attempts
   - SSH access logs
   - Firewall statistics
   - Port scanning detection

// Todo

1. refactor alert coming in from zeromqService. just return the metrics and the formatter will handle the message
2. Add a new bot configuration field to the integration config (done)
3. Make the agent to work with DM on the telex platform
4. Add a periodic check on the package to find out if there's a new version, then send a message to the user via the telex platform to the channelId configured . it should include instructions on how to update the package which is the same command as the one used to install the package.

To-Do List:

1. [ ] Refactor ZeroMQ Service Alert System

   - Separate metrics collection from message formatting
   - Create dedicated formatter service

2. [ ] Implement Telex Platform DM Integration

   - Enable direct message functionality
   - Add rate limiting
   - Add error handling

3. [ ] Set up Weekly Log Directory Cleanup

   - Implement automated cleanup script
   - Add safety measures for current logs

4. [ ] Implement System Load Metrics

   - Process queue length monitoring
   - Context switches tracking
   - System interrupts monitoring
   - Load analysis reporting

5. [ ] Add File System Metrics

   - Mount point usage monitoring
   - Inode usage tracking
   - File system states monitoring

6. [ ] Implement System Services Monitoring

   - Service status tracking
   - Uptime monitoring
   - Resource usage per service
   - Dependencies mapping

7. [ ] Set up Log Monitoring System
   - System log analysis
   - Error log monitoring
   - Custom log file monitoring
   - Pattern matching

// tickets below

TICK-001 (added)
Title: ZeroMQ Service Alert Refactoring
Description: As a developer, I want to refactor the alert system in zeromqService to separate concerns between metrics collection and message formatting, so that the code is more maintainable and follows single responsibility principle.
Acceptance Criteria:

- ZeroMQ service only returns raw metrics data
- Message formatting logic is moved to a dedicated formatter service
- All existing alert functionality continues to work without interruption
- Unit tests are updated to reflect the new structure
  Assignee: TBD
  Timeline: 1-2 days
  Status: TODO
  Label: enhancement, refactor

TICK-002 (added)
Title: Add Bot Configuration Field to Telex Integration Config
Description: As a developer, I need to add a bot configuration field to the telexConfig.ts file to properly identify this integration as a bot in the Telex platform, ensuring proper bot-specific functionality is enabled.
Acceptance Criteria:

- Add 'bot: true' field to the telexGeneratedConfig data object in telexConfig.ts
- Ensure the new field follows the existing configuration structure
- Verify the integration still works after adding the field
- Update integration documentation to reflect the new bot configuration
- Test the integration's bot functionality after the change
  Assignee: TBD
  Timeline: 1 day
  Status: TODO
  Label: feature, configuration

TICK-003 (added)
Title: Telex Platform DM Integration
Description: As a user, I want the monitoring agent to communicate through direct messages on the Telex platform, so that I can receive private notifications about system status.
Acceptance Criteria:

- Agent can send direct messages to specified users on Telex
- Message format is consistent with other notifications
- Error handling for failed DM attempts
- Rate limiting implementation to prevent spam
- Documentation for DM feature setup and usage
  Assignee: TBD
  Timeline: 2-3 days
  Status: TODO
  Label: feature, integration

TICK-004 (added)
Title: Log Directory Cleanup Implementation
Description: As a system administrator, I want the telex-agent logs directory to be automatically cleaned up weekly to prevent excessive disk usage.
Acceptance Criteria:

- Weekly automated cleanup of log files
- Logging of cleanup operations
- Fail-safe mechanisms to prevent accidental deletion of current logs
  Assignee: TBD
  Timeline: 1 day
  Status: TODO
  Label: maintenance, automation

TICK-005 (added)
Title: System Load Metrics Implementation
Description: As a system administrator, I need detailed system load metrics to better understand system performance.
Acceptance Criteria:

- Implementation of process queue length monitoring
- Context switches tracking
- System interrupts monitoring
- Detailed load analysis reporting

  Assignee: TBD
  Timeline: 2-3 days
  Status: TODO
  Label: feature, monitoring

TICK-006 (added)
Title: File System Metrics Integration
Description: As a system administrator, I need comprehensive file system metrics to monitor storage health and usage patterns.
Acceptance Criteria:

- Monitor file system usage by mount point
- Track inode usage and limits
- Report file system types and states
- Collect mount point statistics

  Assignee: TBD
  Timeline: 2 days
  Status: TODO
  Label: feature, monitoring

TICK-007 (added)
Title: System Services Monitoring Implementation
Description: As a system administrator, I need to monitor system services to ensure critical services are running properly.
Acceptance Criteria:

- Service status monitoring implementation
- Service uptime tracking
- Resource usage monitoring per service
- Service dependencies mapping

  Assignee: TBD
  Timeline: 2-3 days
  Status: TODO
  Label: feature, monitoring

TICK-008
Title: Log Monitoring System Implementation
Description: As a system administrator, I need comprehensive log monitoring to detect and respond to system issues proactively.
Acceptance Criteria:

- System log analysis implementation
- Error log monitoring setup
- Custom log file monitoring capability
- Log pattern matching functionality

  Assignee: TBD
  Timeline: 3-4 days
  Status: TODO
  Label: feature, monitoring
