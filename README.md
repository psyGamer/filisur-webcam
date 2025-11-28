# Setup

A few tasks should happen on a regular interval. Following crontab entries are suggested:
```cron
0 0 * * * cd /scripts && ./fetch_locomotive_allocations.sh
```