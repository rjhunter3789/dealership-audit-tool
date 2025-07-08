# Editable Network Benchmarks Design

## Overview
Currently, network benchmarks are hardcoded in the application. This feature will allow users to edit and manage different sets of benchmarks for different time periods, regions, or dealer groups.

## Current Implementation
Network benchmarks are defined in `app.js` as:
```javascript
let networkBenchmarks = {
    totalLeads: 27047,
    conversionRate: 16.12,
    responseRate: 54.9,
    noResponseRate: 45.1,
    fifteenMinResponse: 31.7,
    avgResponseTime: 5.5,
    medianResponseTime: 12
};
```

## Proposed Solution

### 1. Add Settings Navigation Tab
- New "Settings" tab in the main navigation
- Icon: gear/cog icon
- Position: After "Reports" tab

### 2. Settings Interface
The Settings section will include:
- **Network Benchmarks Editor**
  - Form fields for each benchmark metric
  - Save/Reset buttons
  - Import/Export functionality

### 3. Benchmark Sets Feature
- **Preset Benchmarks**: Q1 2025, Q2 2025, Year 2024, etc.
- **Custom Benchmarks**: User-defined sets
- **Active Benchmark**: Dropdown to select which set is currently active

### 4. Storage
- Use localStorage to persist benchmarks
- Default to hardcoded values if no saved benchmarks exist
- Structure:
```javascript
{
  "benchmarkSets": {
    "Q1-2025": { /* benchmark values */ },
    "Q2-2025": { /* benchmark values */ },
    "Custom-1": { /* benchmark values */ }
  },
  "activeBenchmark": "Q1-2025"
}
```

### 5. Import/Export Format
JSON format for easy sharing:
```json
{
  "name": "Q1 2025 PNW Network",
  "date": "2025-01-01",
  "metrics": {
    "totalLeads": 27047,
    "conversionRate": 16.12,
    "responseRate": 54.9,
    "noResponseRate": 45.1,
    "fifteenMinResponse": 31.7,
    "avgResponseTime": 5.5,
    "medianResponseTime": 12
  }
}
```

### 6. UI Components Needed
1. Settings tab and section
2. Benchmark editor form
3. Benchmark set selector
4. Import/Export buttons
5. Save/Cancel/Reset buttons

### 7. Impact on Existing Features
- All comparisons will use the active benchmark set
- Reports will indicate which benchmark set was used
- ROI Calculator "Network Avg" button will use active benchmarks

### 8. Benefits
- Different time periods can have accurate benchmarks
- Regional variations can be accommodated
- Different user groups can use their own benchmarks
- Historical comparisons become possible
- Easy sharing of benchmark configurations

Would you like me to start implementing this feature?