# Setup

A few tasks should happen on a regular interval. Following crontab entries are suggested:
```cron
0 0 * * * cd /scripts && ./fetch_locomotive_allocations.sh
0 6 * * * cd /scripts && ./create_day_video.sh $(date -d "yesterday 13:00" '+%Y-%m-%d')
```