# Lead Performance Intelligence Platform

A web-based analytics platform for analyzing automotive dealership lead performance data.

## Features

- **Data Upload**: Upload Excel/CSV files with dealer lead data
- **Real-time Analysis**: Instant calculation of conversion rates, response times, and performance metrics
- **Network Benchmarking**: Compare individual dealer performance against network averages
- **Revenue Impact Calculator**: See how improving conversion rates affects annual revenue
- **Report Generation**: Create professional reports for network and individual dealer analysis
- **100% Privacy**: All data processing happens locally in your browser - no data is sent to servers

## Quick Start

1. Visit the live app: [https://rjhunter3789.github.io/dealership-audit-tool/](https://rjhunter3789.github.io/dealership-audit-tool/)
2. Upload your dealer lead data (CSV or Excel format)
3. View instant analysis and comparisons
4. Use the Revenue Impact Calculator to see potential improvements
5. Generate reports for stakeholders

## Revenue Impact Calculator

The calculator shows the pure financial impact of improving conversion rates:
- Enter your current monthly lead volume
- Enter your current conversion rate
- Click the quick buttons (+1%, +2%, +3%, etc.) to see revenue impact
- Or manually enter any target conversion rate
- See instant calculations of additional revenue and sales

**New Features:**
- When a dealer is selected in Lead Analysis, the ROI Calculator automatically populates with:
  - The dealer's calculated monthly lead average (based on their data period)
  - Their actual conversion rate
  - Target rate matches current rate for baseline comparison
- Data period is automatically calculated from lead dates
- Monthly averages are extrapolated from the actual data period

## Data Format Requirements

Your lead data file should include these columns:
- Lead Request Date
- Date/Time Actionable
- Response Date
- Lead Type (filter for "Form" leads)
- Vehicle Type (New/Used/CPO)
- Lead Source
- Sale Date (if applicable)

## Key Metrics Analyzed

- **Conversion Rate**: Percentage of leads that result in sales
- **Response Rate**: Percentage of leads that receive a response
- **Response Time Distribution**: Breakdown by time categories (0-15 min, 16-30 min, etc.)
- **No Response Rate**: Critical metric for improvement opportunities
- **Revenue Impact**: Direct financial impact of conversion improvements

## Technology Stack

- Pure HTML/CSS/JavaScript (no backend required)
- Chart.js for interactive visualizations
- Runs entirely in the browser for data privacy
- Mobile responsive design

## Network Benchmarks (Q1-Q2 2025)

- **Total Network Leads**: 27,047
- **Network Conversion Rate**: 16.12%
- **Network Response Rate**: 54.9%
- **Network 15-min Response**: 31.7%
- **Average Response Time**: 5.5 hours

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Cost

**FREE** - No hosting fees, no monthly costs, no API charges. Everything runs locally in your browser.

## Privacy & Security

- All data processing happens in your browser
- No data is uploaded to any server
- No external API calls
- Complete data privacy maintained

## Reports

The platform generates three types of reports:
- **Network Performance Report**: Overview of all dealers in the network
- **Individual Dealer Report**: Detailed analysis for a specific dealer
- **ROI Projection Report**: Financial impact analysis with dealer name included

## Roadmap

### Completed Features ✓
- Data upload and processing (Excel/CSV)
- Lead analysis by dealer
- ROI Calculator with auto-population from selected dealer
- Report generation with PDF export
- Security hardening for enterprise deployment
- Dealer-specific data period calculation

### Planned Features
1. **Editable Network Benchmarks** (Next Priority)
   - Allow users to modify network averages
   - Support different time periods (Q1, Q2, etc.)
   - Save custom benchmark sets
   - Import/export benchmark configurations

2. **Enhanced Analytics**
   - Trend analysis over time
   - Lead source performance comparison
   - Response time impact on conversion

3. **Mobile Optimization**
   - Responsive design improvements
   - Touch-friendly interface
   - Mobile-specific features

4. **Data Management**
   - Multi-file comparison
   - Historical data tracking
   - Export analysis results

## Support

For questions or issues, please open an issue in this repository.

---

Built for Automotive Dealer Networks