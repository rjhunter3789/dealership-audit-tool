// Lead Performance Intelligence Platform
// Main JavaScript Application
// Version: 1.0.0
// Security: Client-side only, no external data transmission

// Note: Strict mode and object freezing removed due to Chart.js compatibility

// Global variables
let currentDealerData = null;
let uploadedDealerData = {};
let currentSelectedDealer = null;
let networkBenchmarks = {
    totalLeads: 27047,
    conversionRate: 16.12,
    responseRate: 54.9,
    noResponseRate: 45.1,
    fifteenMinResponse: 31.7,
    avgResponseTime: 5.5,
    medianResponseTime: 12
};

// Session management - auto-clear data after 30 minutes of inactivity
let lastActivityTime = Date.now();
let sessionTimeout = null;

function resetSessionTimer() {
    lastActivityTime = Date.now();
    if (sessionTimeout) clearTimeout(sessionTimeout);
    
    sessionTimeout = setTimeout(() => {
        // Clear all sensitive data
        currentDealerData = null;
        uploadedDealerData = {};
        currentSelectedDealer = null;
        alert('Session expired for security. Please re-upload your data.');
        location.reload();
    }, 30 * 60 * 1000); // 30 minutes
}

// Track user activity
document.addEventListener('click', resetSessionTimer);
document.addEventListener('keypress', resetSessionTimer);

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    showSection('dashboard');
    calculateROI();
    resetSessionTimer();
    
    // Security: Disable right-click context menu
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        return false;
    });
    
    // Security: Disable text selection on sensitive elements
    document.querySelectorAll('.metric-value, .metric-card').forEach(el => {
        el.style.userSelect = 'none';
        el.style.webkitUserSelect = 'none';
    });
    
    // Initialize charts after a small delay to ensure everything is loaded
    setTimeout(function() {
        initializeCharts();
    }, 100);
});

// HTML escape function for security
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Navigation functionality
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remove active class from all nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected section
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('active');
    }
    
    // Add active class to clicked button (if called from button click)
    if (event && event.target && event.target.classList) {
        event.target.classList.add('active');
    }
}

// Setup event listeners
function setupEventListeners() {
    // File upload drag and drop
    const uploadArea = document.querySelector('.upload-area');
    if (uploadArea) {
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('dragleave', handleDragLeave);
        uploadArea.addEventListener('drop', handleDrop);
    }
}

// Chart initialization
function initializeCharts() {
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded. Charts will not be displayed.');
        setTimeout(initializeCharts, 1000); // Try again in 1 second
        return;
    }
    
    console.log('Chart.js loaded, initializing charts...');
    
    // Response Time Distribution Chart
    const responseCtx = document.getElementById('responseTimeChart');
    console.log('Response chart canvas:', responseCtx);
    if (responseCtx) {
        new Chart(responseCtx, {
            type: 'doughnut',
            data: {
                labels: ['0-15 min', '16-30 min', '30-60 min', '1-24 hrs', '1+ days', 'No Response'],
                datasets: [{
                    data: [31.7, 7.8, 8.3, 15.2, 4.5, 45.1],
                    backgroundColor: [
                        '#4CAF50',
                        '#8BC34A',
                        '#FFC107',
                        '#FF9800',
                        '#FF5722',
                        '#F44336'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + context.parsed + '%';
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Conversion by Response Time Chart
    const conversionCtx = document.getElementById('conversionChart');
    if (conversionCtx) {
        new Chart(conversionCtx, {
            type: 'bar',
            data: {
                labels: ['0-15 min', '16-30 min', '30-60 min', '1-24 hrs', '1+ days', 'No Response'],
                datasets: [{
                    label: 'Conversion Rate (%)',
                    data: [18.5, 17.8, 16.9, 14.2, 12.1, 5.9],
                    backgroundColor: '#003478'
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    }
}

// File upload handlers
function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

function uploadFile() {
    document.getElementById('fileInput').click();
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        processFile(file);
    }
}

// Enhanced data sanitization
function sanitizeString(str) {
    if (typeof str !== 'string') return '';
    // Remove any potential script tags or HTML
    return str.replace(/<[^>]*>/g, '')
              .replace(/javascript:/gi, '')
              .replace(/on\w+\s*=/gi, '')
              .trim();
}

// Process uploaded file
function processFile(file) {
    // Security: Reset activity timer
    resetSessionTimer();
    
    // Validate file
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const fileName = file.name.toLowerCase();
    const fileExt = fileName.substring(fileName.lastIndexOf('.'));
    
    // Security: Filename validation - allow more characters but still safe
    if (!/^[\w\-. ()_']+$/i.test(file.name.replace(fileExt, ''))) {
        alert('Invalid filename. Please avoid special characters like <, >, :, ", |, ?, *');
        return;
    }
    
    if (!allowedTypes.includes(fileExt)) {
        alert('Invalid file type. Please upload a CSV or Excel file.');
        return;
    }
    
    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        alert('File too large. Maximum size is 10MB.');
        return;
    }
    
    // Security: Validate MIME type
    const validMimeTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/csv',
        'text/plain'
    ];
    
    if (file.type && !validMimeTypes.includes(file.type)) {
        console.warn('Unexpected MIME type:', file.type);
    }
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            let data;
            
            if (fileExt === '.csv') {
                // Parse CSV
                data = parseCSV(e.target.result);
            } else {
                // Parse Excel
                const workbook = XLSX.read(e.target.result, { type: 'binary' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                
                // Convert to array starting from row 10 (headers) and row 12 (data)
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
                    header: 1,
                    raw: false
                });
                
                // Extract headers from row 10 (index 9)
                const headers = jsonData[9];
                data = [];
                
                // Get the dealer name from row 2, column B (index 1)
                const dealerName = jsonData[1] && jsonData[1][1] ? jsonData[1][1].toString().trim() : 'Unknown Dealer';
                console.log('Dealer name from row 2:', dealerName);
                
                // Extract data starting from row 12 (index 11)
                for (let i = 11; i < jsonData.length; i++) {
                    const row = {};
                    const values = jsonData[i];
                    headers.forEach((header, index) => {
                        row[header] = values[index] ? sanitizeString(values[index].toString()) : '';
                    });
                    // Add the dealer name to each row
                    row['Dealer Name'] = dealerName;
                    if (Object.values(row).some(v => v !== '')) {
                        data.push(row);
                    }
                }
                
                console.log('Excel headers found:', headers);
                console.log('Excel data rows found:', data.length);
                if (data.length > 0) {
                    console.log('First Excel data row:', data[0]);
                }
            }
            
            analyzeLeadData(data);
        } catch (error) {
            alert('Error processing file: ' + error.message);
            console.error('File processing error:', error);
        }
    };
    
    reader.onerror = function() {
        alert('Error reading file. Please try again.');
    };
    
    if (fileExt === '.csv') {
        reader.readAsText(file);
    } else {
        reader.readAsBinaryString(file);
    }
}

// Parse CSV data
function parseCSV(csvText) {
    const lines = csvText.split('\n');
    
    // Get the dealer name from row 2 (index 1), after "Dealer Name:" label
    let dealerName = 'Unknown Dealer';
    if (lines[1]) {
        const dealerLine = lines[1].split(',');
        if (dealerLine.length > 1) {
            dealerName = dealerLine[1].trim().replace(/"/g, '');
        }
    }
    console.log('CSV Dealer name from row 2:', dealerName);
    
    // Skip the first 11 rows (0-10) to get to the column headers at row 10 (index 9)
    const headers = lines[9].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = [];
    
    // Start from row 12 (index 11) where the actual data begins
    for (let i = 11; i < lines.length; i++) {
        if (lines[i].trim()) {
            const values = lines[i].split(',').map(v => sanitizeString(v.replace(/"/g, '')));
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            // Add the dealer name to each row
            row['Dealer Name'] = sanitizeString(dealerName);
            data.push(row);
        }
    }
    
    console.log('Headers found:', headers);
    console.log('Data rows found:', data.length);
    if (data.length > 0) {
        console.log('First data row:', data[0]);
    }
    
    return data;
}

// Analyze lead data
function analyzeLeadData(data) {
    // Debug: Show what columns we found
    if (data.length > 0) {
        console.log('Columns found:', Object.keys(data[0]));
        console.log('First row data:', data[0]);
    }
    
    // Try multiple variations of column names
    const leadTypeVariations = ['Lead Type', 'LeadType', 'lead type', 'LEAD TYPE', 'Type'];
    let leadTypeColumn = null;
    
    // Find which column name exists
    for (let col of leadTypeVariations) {
        if (data.length > 0 && data[0].hasOwnProperty(col)) {
            leadTypeColumn = col;
            console.log('Found lead type column:', col);
            break;
        }
    }
    
    // Filter for form leads with flexible matching
    const formLeads = data.filter(row => {
        if (!leadTypeColumn) return false;
        const leadType = row[leadTypeColumn];
        // Check various ways "Form" might appear
        return leadType && (
            leadType === 'Form' || 
            leadType.toLowerCase() === 'form' ||
            leadType.trim() === 'Form' ||
            leadType.includes('Form')
        );
    });
    
    console.log('Total rows: ' + data.length + ', Form leads found: ' + formLeads.length);
    
    // Show a sample of lead types found
    if (data.length > 0 && leadTypeColumn) {
        const sampleTypes = data.slice(0, 5).map(row => row[leadTypeColumn]);
        console.log('Sample lead types:', sampleTypes);
    }
    
    if (formLeads.length === 0) {
        alert('No form leads found. Check browser console for debug info.');
        return;
    }
    
    // Reset dealer data
    uploadedDealerData = {};
    
    // We already added 'Dealer Name' to each row during Excel parsing
    const dealerColumn = 'Dealer Name';
    
    // Get unique dealer names
    const dealerNames = [...new Set(formLeads.map(row => row[dealerColumn] || ''))].filter(name => name !== '');
    
    if (dealerNames.length === 0) {
        // If no dealer names found, group all as one
        uploadedDealerData['All Dealers'] = analyzeDealerSpecificData(formLeads, 'All Dealers');
    } else {
        // Store data by dealer
        dealerNames.forEach(dealer => {
            const dealerFormLeads = formLeads.filter(row => row[dealerColumn] === dealer);
            if (dealerFormLeads.length > 0) {
                uploadedDealerData[dealer] = analyzeDealerSpecificData(dealerFormLeads, dealer);
            }
        });
    }
    
    // Update dealer dropdown
    updateDealerDropdown();
    
    // Show the dealer selector
    const uploadNotice = document.getElementById('analysisUploadNotice');
    const dealerSelector = document.getElementById('dealerSelectorDiv');
    if (uploadNotice) uploadNotice.style.display = 'none';
    if (dealerSelector) dealerSelector.style.display = 'block';
    
    // Show detailed success message
    alert('Data uploaded successfully!\nFound ' + dealerNames.length + ' dealer(s)\n' + formLeads.length + ' form leads\nDealer column: ' + dealerColumn);
}

// New function to analyze dealer-specific data
function analyzeDealerSpecificData(dealerLeads, dealerName) {
    const metrics = {
        dealerName: dealerName,
        totalLeads: dealerLeads.length,
        totalSales: dealerLeads.filter(row => row['Sale Date'] && row['Sale Date'].trim() !== '').length,
        conversionRate: 0,
        noResponseCount: dealerLeads.filter(row => !row['Response Date'] || row['Response Date'] === 'N/A' || row['Response Date'].trim() === '').length,
        noResponseRate: 0,
        responseRate: 0,
        leadsBySource: {},
        monthlyTrend: {},
        avgResponseTime: 0,
        dataMonths: 0,
        monthlyLeadAverage: 0
    };
    
    // Calculate the data period by finding earliest and latest lead dates
    let earliestDate = null;
    let latestDate = null;
    
    dealerLeads.forEach(lead => {
        const leadDateStr = lead['Lead Date'] || lead['Date'] || lead['Created Date'] || '';
        if (leadDateStr && leadDateStr.trim() !== '') {
            try {
                const leadDate = new Date(leadDateStr);
                if (!isNaN(leadDate.getTime())) {
                    if (!earliestDate || leadDate < earliestDate) earliestDate = leadDate;
                    if (!latestDate || leadDate > latestDate) latestDate = leadDate;
                }
            } catch (e) {
                // Skip invalid dates
            }
        }
    });
    
    // Calculate the number of months in the data period
    if (earliestDate && latestDate) {
        const monthsDiff = (latestDate.getFullYear() - earliestDate.getFullYear()) * 12 + 
                          (latestDate.getMonth() - earliestDate.getMonth()) + 1;
        metrics.dataMonths = Math.max(1, monthsDiff);
        metrics.monthlyLeadAverage = Math.round(metrics.totalLeads / metrics.dataMonths);
    } else {
        // Default to 6 months if we can't determine the period
        metrics.dataMonths = 6;
        metrics.monthlyLeadAverage = Math.round(metrics.totalLeads / 6);
    }
    
    // Calculate rates
    metrics.conversionRate = metrics.totalLeads > 0 
        ? ((metrics.totalSales / metrics.totalLeads) * 100).toFixed(2) 
        : '0.00';
    metrics.noResponseRate = metrics.totalLeads > 0 
        ? ((metrics.noResponseCount / metrics.totalLeads) * 100).toFixed(1)
        : '0.0';
    metrics.responseRate = (100 - parseFloat(metrics.noResponseRate)).toFixed(1);
    
    // Calculate lead sources
    dealerLeads.forEach(lead => {
        const source = lead['Lead Source'] || lead['Source'] || lead['Lead Source of Data'] || 'Unknown';
        metrics.leadsBySource[source] = (metrics.leadsBySource[source] || 0) + 1;
    });
    
    return metrics;
}

// Update dealer dropdown with uploaded data
function updateDealerDropdown() {
    const select = document.getElementById('dealerSelect');
    
    // Clear existing options except the first one
    select.innerHTML = '<option value="">Choose a dealer...</option>';
    
    // Add dealers from uploaded data
    Object.keys(uploadedDealerData).sort().forEach(dealer => {
        const option = document.createElement('option');
        option.value = dealer;
        option.textContent = dealer;
        select.appendChild(option);
    });
}

// Update dealer analysis when selection changes
function updateDealerAnalysis() {
    const selectedDealer = document.getElementById('dealerSelect').value;
    
    if (!selectedDealer || !uploadedDealerData[selectedDealer]) {
        document.getElementById('dealerAnalysisResults').innerHTML = 
            '<p class="placeholder">Select a dealer to view detailed analysis</p>';
        currentSelectedDealer = null;
        
        // Reset ROI calculator to network defaults
        document.getElementById('monthlyLeads').value = Math.round(networkBenchmarks.totalLeads / 12);
        document.getElementById('currentConversion').value = networkBenchmarks.conversionRate;
        document.getElementById('targetConversion').value = networkBenchmarks.conversionRate;
        calculateROI();
        return;
    }
    
    currentSelectedDealer = selectedDealer;
    const metrics = uploadedDealerData[selectedDealer];
    
    // Update ROI Calculator with dealer's actual data
    document.getElementById('monthlyLeads').value = metrics.monthlyLeadAverage;
    document.getElementById('currentConversion').value = metrics.conversionRate;
    document.getElementById('targetConversion').value = metrics.conversionRate;
    calculateROI();
    
    // Create comprehensive analysis display
    const resultsDiv = document.getElementById('dealerAnalysisResults');
    
    // Build the lead sources list first
    const leadSourcesList = Object.entries(metrics.leadsBySource)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([source, count]) => {
            const percentage = ((count/metrics.totalLeads)*100).toFixed(1);
            return '<li>' + escapeHtml(source) + ': ' + count + ' leads (' + percentage + '%)</li>';
        }).join('');
    
    // Build the HTML
    const html = '<h3>' + escapeHtml(metrics.dealerName) + ' - Performance Analysis</h3>' +
        '<div class="executive-summary">' +
        '<h4>Executive Summary</h4>' +
        '<p>' + escapeHtml(metrics.dealerName) + ' processed ' + metrics.totalLeads.toLocaleString() + ' form leads ' +
        'with a ' + metrics.conversionRate + '% conversion rate, ' +
        (parseFloat(metrics.conversionRate) >= networkBenchmarks.conversionRate ? 'exceeding' : 'below') +
        ' the PNW network average of ' + networkBenchmarks.conversionRate + '%.</p>' +
        '<button class="download-btn" onclick="downloadExecutiveSummary()">Download Executive Summary PDF</button>' +
        '</div>' +
        '<div class="metrics-grid">' +
        '<div class="metric-card">' +
        '<h3>Total Form Leads</h3>' +
        '<p class="metric-value">' + metrics.totalLeads.toLocaleString() + '</p>' +
        '</div>' +
        '<div class="metric-card">' +
        '<h3>Conversion Rate</h3>' +
        '<p class="metric-value">' + metrics.conversionRate + '%</p>' +
        '<p class="metric-change ' + (parseFloat(metrics.conversionRate) >= networkBenchmarks.conversionRate ? 'positive' : 'negative') + '">' +
        'Network: ' + networkBenchmarks.conversionRate + '%' +
        '</p>' +
        '</div>' +
        '<div class="metric-card">' +
        '<h3>Response Rate</h3>' +
        '<p class="metric-value">' + metrics.responseRate + '%</p>' +
        '<p class="metric-change ' + (parseFloat(metrics.responseRate) >= networkBenchmarks.responseRate ? 'positive' : 'negative') + '">' +
        'Network: ' + networkBenchmarks.responseRate + '%' +
        '</p>' +
        '</div>' +
        '<div class="metric-card">' +
        '<h3>Total Sales</h3>' +
        '<p class="metric-value">' + metrics.totalSales.toLocaleString() + '</p>' +
        '</div>' +
        '</div>' +
        '<div class="lead-sources">' +
        '<h4>Top Lead Sources</h4>' +
        '<ul>' + leadSourcesList + '</ul>' +
        '</div>';
    
    resultsDiv.innerHTML = html;
}

// Download Executive Summary as PDF
function downloadExecutiveSummary() {
    if (!currentSelectedDealer || !uploadedDealerData[currentSelectedDealer]) {
        alert('Please select a dealer first');
        return;
    }
    
    const metrics = uploadedDealerData[currentSelectedDealer];
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write('<!DOCTYPE html>' +
        '<html>' +
        '<head>' +
        '<title>' + metrics.dealerName + ' - Executive Summary</title>' +
        '<style>' +
        'body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 40px; }' +
        'h1 { color: #003478; border-bottom: 3px solid #003478; padding-bottom: 10px; }' +
        'h2 { color: #0055b8; margin-top: 30px; }' +
        '.metric { margin: 20px 0; }' +
        '.metric-label { font-weight: bold; color: #666; }' +
        '.metric-value { font-size: 1.5em; color: #003478; }' +
        '.comparison { color: ' + (parseFloat(metrics.conversionRate) >= networkBenchmarks.conversionRate ? 'green' : 'red') + '; }' +
        'table { width: 100%; border-collapse: collapse; margin: 20px 0; }' +
        'th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }' +
        'th { background-color: #f5f5f5; font-weight: bold; }' +
        '@media print { body { padding: 20px; } }' +
        '</style>' +
        '</head>' +
        '<body>' +
        '<h1>' + escapeHtml(metrics.dealerName) + '</h1>' +
        '<h2>Executive Summary - Lead Performance Analysis</h2>' +
        '<p><strong>Analysis Date:</strong> ' + new Date().toLocaleDateString() + '</p>' +
        '<div class="metric">' +
        '<span class="metric-label">Total Form Leads Analyzed:</span> ' +
        '<span class="metric-value">' + metrics.totalLeads.toLocaleString() + '</span>' +
        '</div>' +
        '<div class="metric">' +
        '<span class="metric-label">Conversion Rate:</span> ' +
        '<span class="metric-value">' + metrics.conversionRate + '%</span> ' +
        '<span class="comparison">(Network Average: ' + networkBenchmarks.conversionRate + '%)</span>' +
        '</div>' +
        '<div class="metric">' +
        '<span class="metric-label">Total Sales:</span> ' +
        '<span class="metric-value">' + metrics.totalSales.toLocaleString() + '</span>' +
        '</div>' +
        '<div class="metric">' +
        '<span class="metric-label">Response Rate:</span> ' +
        '<span class="metric-value">' + metrics.responseRate + '%</span> ' +
        '<span class="comparison">(Network Average: ' + networkBenchmarks.responseRate + '%)</span>' +
        '</div>' +
        '<h2>Revenue Impact Analysis</h2>' +
        '<table>' +
        '<tr><th>Metric</th><th>Current</th><th>At Network Average</th><th>Opportunity</th></tr>' +
        '<tr>' +
        '<td>Annual Sales (Projected)</td>' +
        '<td>' + (metrics.totalSales * 2).toLocaleString() + '</td>' +
        '<td>' + Math.round(metrics.totalLeads * 2 * (networkBenchmarks.conversionRate / 100)).toLocaleString() + '</td>' +
        '<td>' + Math.max(0, Math.round(metrics.totalLeads * 2 * (networkBenchmarks.conversionRate / 100)) - (metrics.totalSales * 2)).toLocaleString() + '</td>' +
        '</tr>' +
        '<tr>' +
        '<td>Annual Revenue</td>' +
        '<td>$' + (metrics.totalSales * 2 * 4255).toLocaleString() + '</td>' +
        '<td>$' + Math.round(metrics.totalLeads * 2 * (networkBenchmarks.conversionRate / 100) * 4255).toLocaleString() + '</td>' +
        '<td>$' + Math.max(0, Math.round(metrics.totalLeads * 2 * (networkBenchmarks.conversionRate / 100) * 4255) - (metrics.totalSales * 2 * 4255)).toLocaleString() + '</td>' +
        '</tr>' +
        '</table>' +
        '<h2>Top Lead Sources</h2>' +
        '<table>' +
        '<tr><th>Source</th><th>Lead Count</th><th>Percentage</th></tr>' +
        Object.entries(metrics.leadsBySource)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([source, count]) => 
                '<tr>' +
                '<td>' + escapeHtml(source) + '</td>' +
                '<td>' + count + '</td>' +
                '<td>' + ((count / metrics.totalLeads) * 100).toFixed(1) + '%</td>' +
                '</tr>'
            ).join('') +
        '</table>' +
        '<h2>Recommendations</h2>' +
        '<ul>' +
        (parseFloat(metrics.responseRate) < networkBenchmarks.responseRate ? 
            '<li>Improve response rate to match network average of ' + networkBenchmarks.responseRate + '%</li>' : '') +
        (parseFloat(metrics.conversionRate) < networkBenchmarks.conversionRate ? 
            '<li>Focus on conversion optimization to reach network average of ' + networkBenchmarks.conversionRate + '%</li>' : '') +
        (parseFloat(metrics.noResponseRate) > 30 ? 
            '<li>Reduce no-response rate from ' + metrics.noResponseRate + '% to under 30%</li>' : '') +
        '<li>Analyze top-performing lead sources for optimization opportunities</li>' +
        '<li>Implement automated response systems for faster lead engagement</li>' +
        '</ul>' +
        '<p style="margin-top: 50px; font-size: 0.9em; color: #666;">' +
        'Generated by PNW Ford Lead Performance Intelligence Platform<br>' +
        new Date().toLocaleString() +
        '</p>' +
        '</body>' +
        '</html>'
    );
    
    printWindow.document.close();
    
    // Wait for content to load then trigger print dialog
    setTimeout(() => {
        printWindow.print();
        // Close the window after printing (optional)
        printWindow.onafterprint = function() {
            printWindow.close();
        };
    }, 250);
}

// ROI Calculator - Simplified version focusing on revenue impact
function calculateROI() {
    // Get and validate inputs
    const monthlyLeads = Math.max(0, parseFloat(document.getElementById('monthlyLeads').value) || 0);
    const currentConversion = Math.max(0, Math.min(100, parseFloat(document.getElementById('currentConversion').value) || 0));
    const targetConversion = Math.max(0, Math.min(100, parseFloat(document.getElementById('targetConversion').value) || 0));
    const avgDealValue = Math.max(0, parseFloat(document.getElementById('avgDealValue').value) || 0);
    
    // Annual calculations
    const annualLeads = monthlyLeads * 12;
    const currentSales = Math.round(annualLeads * (currentConversion / 100));
    const targetSales = Math.round(annualLeads * (targetConversion / 100));
    const additionalSales = targetSales - currentSales;
    
    // Revenue calculations
    const currentRevenue = currentSales * avgDealValue;
    const targetRevenue = targetSales * avgDealValue;
    const additionalRevenue = targetRevenue - currentRevenue;
    
    // Calculate percentage increase
    const percentIncrease = currentRevenue > 0 ? ((additionalRevenue / currentRevenue) * 100).toFixed(1) : 0;
    
    // Update current performance
    document.getElementById('currentSales').textContent = currentSales.toLocaleString();
    document.getElementById('currentRevenue').textContent = '$' + currentRevenue.toLocaleString();
    
    // Update improved performance
    document.getElementById('improvedSales').textContent = targetSales.toLocaleString();
    document.getElementById('improvedRevenue').textContent = '$' + targetRevenue.toLocaleString();
    
    // Update impact metrics
    document.getElementById('additionalRevenue').textContent = '$' + additionalRevenue.toLocaleString();
    document.getElementById('additionalSales').textContent = additionalSales.toLocaleString();
    document.getElementById('percentIncrease').textContent = percentIncrease + '%';
}

// Helper functions for quick conversion improvements
function setImprovement(percent) {
    const currentConversion = parseFloat(document.getElementById('currentConversion').value) || 0;
    document.getElementById('targetConversion').value = (currentConversion + percent).toFixed(2);
    calculateROI();
}

function setImprovementToNetwork() {
    document.getElementById('targetConversion').value = networkBenchmarks.conversionRate;
    calculateROI();
}

// Report generation functions
function generateNetworkReport() {
    const output = document.getElementById('reportOutput');
    output.classList.add('active');
    
    const html = '<h3>PNW Ford Network Performance Report</h3>' +
        '<p><strong>Analysis Period:</strong> Q1-Q2 2025</p>' +
        '<p><strong>Total Network Leads:</strong> ' + networkBenchmarks.totalLeads.toLocaleString() + '</p>' +
        '<p><strong>Network Conversion Rate:</strong> ' + networkBenchmarks.conversionRate + '%</p>' +
        '<p><strong>Key Findings:</strong></p>' +
        '<ul>' +
        '<li>45.1% of leads receive no response - critical improvement opportunity</li>' +
        '<li>Leads responded to within 15 minutes convert at 18.5% vs 5.9% for no response</li>' +
        '<li>Network-wide revenue opportunity: $15M-$37M annually</li>' +
        '<li>Average ROI potential: 400-1500% with 3-8 month payback</li>' +
        '</ul>' +
        '<button class="report-btn" onclick="downloadReport(\'network\')">Download PDF</button>';
    
    output.innerHTML = html;
}

function generateDealerReport() {
    const output = document.getElementById('reportOutput');
    output.classList.add('active');
    
    if (!currentSelectedDealer || !uploadedDealerData[currentSelectedDealer]) {
        output.innerHTML = '<p>Please select a dealer from the Lead Analysis tab first.</p>';
        return;
    }
    
    const dealerData = uploadedDealerData[currentSelectedDealer];
    
    const html = '<h3>Individual Dealer Performance Report</h3>' +
        '<p><strong>Dealer:</strong> ' + escapeHtml(dealerData.dealerName) + '</p>' +
        '<p><strong>Total Leads Analyzed:</strong> ' + dealerData.totalLeads + '</p>' +
        '<p><strong>Conversion Rate:</strong> ' + dealerData.conversionRate + '% (Network: ' + networkBenchmarks.conversionRate + '%)</p>' +
        '<p><strong>Response Rate:</strong> ' + dealerData.responseRate + '% (Network: ' + networkBenchmarks.responseRate + '%)</p>' +
        '<p><strong>Performance Classification:</strong> ' + getPerformanceTier(parseFloat(dealerData.conversionRate)) + '</p>' +
        '<button class="report-btn" onclick="downloadReport(\'dealer\')">Download PDF</button>';
    
    output.innerHTML = html;
}

function generateROIReport() {
    const output = document.getElementById('reportOutput');
    output.classList.add('active');
    
    // Get current values from ROI Calculator
    const monthlyLeads = parseFloat(document.getElementById('monthlyLeads').value) || 873;
    const currentConversion = parseFloat(document.getElementById('currentConversion').value) || 10.91;
    const targetConversion = parseFloat(document.getElementById('targetConversion').value) || 12.91;
    const avgDealValue = parseFloat(document.getElementById('avgDealValue').value) || 4255;
    
    // Calculate values
    const annualLeads = monthlyLeads * 12;
    const currentSales = Math.round(annualLeads * (currentConversion / 100));
    const targetSales = Math.round(annualLeads * (targetConversion / 100));
    const additionalSales = targetSales - currentSales;
    const currentRevenue = currentSales * avgDealValue;
    const targetRevenue = targetSales * avgDealValue;
    const additionalRevenue = targetRevenue - currentRevenue;
    const percentIncrease = currentRevenue > 0 ? ((additionalRevenue / currentRevenue) * 100).toFixed(1) : 0;
    
    // Get dealer name if selected
    const dealerName = currentSelectedDealer ? escapeHtml(currentSelectedDealer) : 'Your Dealership';
    
    const html = '<h3>ROI Projection Report</h3>' +
        '<p><strong>Dealership:</strong> ' + dealerName + '</p>' +
        '<p><strong>Your Dealership Metrics:</strong></p>' +
        '<ul>' +
        '<li>Monthly Lead Volume: ' + monthlyLeads.toLocaleString() + '</li>' +
        '<li>Current Conversion Rate: ' + currentConversion + '%</li>' +
        '<li>Target Conversion Rate: ' + targetConversion + '%</li>' +
        '<li>Average Deal Value: $' + avgDealValue.toLocaleString() + '</li>' +
        '</ul>' +
        '<p><strong>Annual Performance Impact:</strong></p>' +
        '<ul>' +
        '<li>Current Annual Sales: ' + currentSales.toLocaleString() + ' units</li>' +
        '<li>Projected Annual Sales: ' + targetSales.toLocaleString() + ' units</li>' +
        '<li>Additional Sales: ' + additionalSales.toLocaleString() + ' units</li>' +
        '<li>Current Annual Revenue: $' + currentRevenue.toLocaleString() + '</li>' +
        '<li>Projected Annual Revenue: $' + targetRevenue.toLocaleString() + '</li>' +
        '<li>Additional Revenue: $' + additionalRevenue.toLocaleString() + '</li>' +
        '<li>Revenue Increase: ' + percentIncrease + '%</li>' +
        '</ul>' +
        '<p><strong>Industry Benchmarks:</strong></p>' +
        '<ul>' +
        '<li>Network Average Conversion: ' + networkBenchmarks.conversionRate + '%</li>' +
        '<li>Typical ROI: 400-1500% with 3-8 month payback</li>' +
        '</ul>' +
        '<button class="report-btn" onclick="downloadReport(\'roi\')">Download PDF</button>';
    
    output.innerHTML = html;
}

// Helper function to determine performance tier
function getPerformanceTier(conversionRate) {
    if (conversionRate >= 20) return 'Elite Performer';
    if (conversionRate >= 16) return 'Strong Performer';
    if (conversionRate >= 12) return 'Average Performer';
    return 'Challenge Dealer';
}

// Download report functionality
function downloadReport(type) {
    if (type === 'network') {
        downloadNetworkReport();
    } else if (type === 'dealer') {
        downloadDealerReport();
    } else if (type === 'roi') {
        downloadROIReport();
    }
}

// Download Network Performance Report as PDF
function downloadNetworkReport() {
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write('<!DOCTYPE html>' +
        '<html>' +
        '<head>' +
        '<title>PNW Ford Network Performance Report</title>' +
        '<style>' +
        'body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 40px; }' +
        'h1 { color: #003478; border-bottom: 3px solid #003478; padding-bottom: 10px; }' +
        'h2 { color: #0055b8; margin-top: 30px; }' +
        '.metric { margin: 20px 0; }' +
        '.metric-label { font-weight: bold; color: #666; }' +
        '.metric-value { font-size: 1.5em; color: #003478; }' +
        'ul { margin: 20px 0; }' +
        'li { margin: 10px 0; }' +
        '@media print { body { padding: 20px; } }' +
        '</style>' +
        '</head>' +
        '<body>' +
        '<h1>PNW Ford Network Performance Report</h1>' +
        '<p><strong>Analysis Period:</strong> Q1-Q2 2025</p>' +
        '<p><strong>Report Generated:</strong> ' + new Date().toLocaleDateString() + '</p>' +
        '<h2>Network Overview</h2>' +
        '<div class="metric">' +
        '<span class="metric-label">Total Network Leads:</span> ' +
        '<span class="metric-value">' + networkBenchmarks.totalLeads.toLocaleString() + '</span>' +
        '</div>' +
        '<div class="metric">' +
        '<span class="metric-label">Network Conversion Rate:</span> ' +
        '<span class="metric-value">' + networkBenchmarks.conversionRate + '%</span>' +
        '</div>' +
        '<div class="metric">' +
        '<span class="metric-label">Network Response Rate:</span> ' +
        '<span class="metric-value">' + networkBenchmarks.responseRate + '%</span>' +
        '</div>' +
        '<div class="metric">' +
        '<span class="metric-label">No Response Rate:</span> ' +
        '<span class="metric-value">' + networkBenchmarks.noResponseRate + '%</span>' +
        '</div>' +
        '<h2>Key Findings</h2>' +
        '<ul>' +
        '<li>45.1% of leads receive no response - critical improvement opportunity</li>' +
        '<li>Leads responded to within 15 minutes convert at 18.5% vs 5.9% for no response</li>' +
        '<li>Network-wide revenue opportunity: $15M-$37M annually</li>' +
        '<li>Average ROI potential: 400-1500% with 3-8 month payback</li>' +
        '<li>31 dealerships analyzed across the Pacific Northwest</li>' +
        '</ul>' +
        '<h2>Performance Tiers</h2>' +
        '<ul>' +
        '<li><strong>Elite Performers (20%+ conversion):</strong> 6 dealers</li>' +
        '<li><strong>Strong Performers (16-20% conversion):</strong> 8 dealers</li>' +
        '<li><strong>Average Performers (12-16% conversion):</strong> 10 dealers</li>' +
        '<li><strong>Challenge Dealers (<12% conversion):</strong> 7 dealers</li>' +
        '</ul>' +
        '<p style="margin-top: 50px; font-size: 0.9em; color: #666;">' +
        'Generated by PNW Ford Lead Performance Intelligence Platform<br>' +
        new Date().toLocaleString() +
        '</p>' +
        '</body>' +
        '</html>'
    );
    
    printWindow.document.close();
    setTimeout(() => {
        printWindow.print();
        printWindow.onafterprint = function() {
            printWindow.close();
        };
    }, 250);
}

// Download Individual Dealer Report as PDF
function downloadDealerReport() {
    if (!currentSelectedDealer || !uploadedDealerData[currentSelectedDealer]) {
        alert('Please select a dealer from the Lead Analysis tab first.');
        return;
    }
    
    const dealerData = uploadedDealerData[currentSelectedDealer];
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write('<!DOCTYPE html>' +
        '<html>' +
        '<head>' +
        '<title>' + dealerData.dealerName + ' - Performance Report</title>' +
        '<style>' +
        'body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 40px; }' +
        'h1 { color: #003478; border-bottom: 3px solid #003478; padding-bottom: 10px; }' +
        'h2 { color: #0055b8; margin-top: 30px; }' +
        '.metric { margin: 20px 0; }' +
        '.metric-label { font-weight: bold; color: #666; }' +
        '.metric-value { font-size: 1.5em; color: #003478; }' +
        '.comparison { color: ' + (parseFloat(dealerData.conversionRate) >= networkBenchmarks.conversionRate ? 'green' : 'red') + '; }' +
        '@media print { body { padding: 20px; } }' +
        '</style>' +
        '</head>' +
        '<body>' +
        '<h1>' + escapeHtml(dealerData.dealerName) + '</h1>' +
        '<h2>Individual Dealer Performance Report</h2>' +
        '<p><strong>Report Generated:</strong> ' + new Date().toLocaleDateString() + '</p>' +
        '<div class="metric">' +
        '<span class="metric-label">Total Leads Analyzed:</span> ' +
        '<span class="metric-value">' + dealerData.totalLeads.toLocaleString() + '</span>' +
        '</div>' +
        '<div class="metric">' +
        '<span class="metric-label">Conversion Rate:</span> ' +
        '<span class="metric-value">' + dealerData.conversionRate + '%</span> ' +
        '<span class="comparison">(Network: ' + networkBenchmarks.conversionRate + '%)</span>' +
        '</div>' +
        '<div class="metric">' +
        '<span class="metric-label">Response Rate:</span> ' +
        '<span class="metric-value">' + dealerData.responseRate + '%</span> ' +
        '<span class="comparison">(Network: ' + networkBenchmarks.responseRate + '%)</span>' +
        '</div>' +
        '<div class="metric">' +
        '<span class="metric-label">Performance Classification:</span> ' +
        '<span class="metric-value">' + getPerformanceTier(parseFloat(dealerData.conversionRate)) + '</span>' +
        '</div>' +
        '<p style="margin-top: 50px; font-size: 0.9em; color: #666;">' +
        'Generated by PNW Ford Lead Performance Intelligence Platform<br>' +
        new Date().toLocaleString() +
        '</p>' +
        '</body>' +
        '</html>'
    );
    
    printWindow.document.close();
    setTimeout(() => {
        printWindow.print();
        printWindow.onafterprint = function() {
            printWindow.close();
        };
    }, 250);
}

// Download ROI Projection Report as PDF
function downloadROIReport() {
    const monthlyLeads = parseFloat(document.getElementById('monthlyLeads').value) || 873;
    const currentConversion = parseFloat(document.getElementById('currentConversion').value) || 10.91;
    const targetConversion = parseFloat(document.getElementById('targetConversion').value) || 12.91;
    const avgDealValue = parseFloat(document.getElementById('avgDealValue').value) || 4255;
    
    const annualLeads = monthlyLeads * 12;
    const currentSales = Math.round(annualLeads * (currentConversion / 100));
    const targetSales = Math.round(annualLeads * (targetConversion / 100));
    const additionalSales = targetSales - currentSales;
    const currentRevenue = currentSales * avgDealValue;
    const targetRevenue = targetSales * avgDealValue;
    const additionalRevenue = targetRevenue - currentRevenue;
    const percentIncrease = currentRevenue > 0 ? ((additionalRevenue / currentRevenue) * 100).toFixed(1) : 0;
    
    const printWindow = window.open('', '_blank');
    
    // Get dealer name if selected
    const dealerName = currentSelectedDealer ? currentSelectedDealer : 'Your Dealership';
    
    printWindow.document.write('<!DOCTYPE html>' +
        '<html>' +
        '<head>' +
        '<title>ROI Projection Report - ' + dealerName + '</title>' +
        '<style>' +
        'body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 40px; }' +
        'h1 { color: #003478; border-bottom: 3px solid #003478; padding-bottom: 10px; }' +
        'h2 { color: #0055b8; margin-top: 30px; }' +
        'table { width: 100%; border-collapse: collapse; margin: 20px 0; }' +
        'th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }' +
        'th { background-color: #f5f5f5; font-weight: bold; }' +
        '.highlight { background-color: #e3f2fd; font-weight: bold; }' +
        '@media print { body { padding: 20px; } }' +
        '</style>' +
        '</head>' +
        '<body>' +
        '<h1>ROI Projection Report</h1>' +
        '<p><strong>Dealership:</strong> ' + dealerName + '</p>' +
        '<p><strong>Report Generated:</strong> ' + new Date().toLocaleDateString() + '</p>' +
        '<h2>Dealership Metrics</h2>' +
        '<table>' +
        '<tr><th>Metric</th><th>Value</th></tr>' +
        '<tr><td>Monthly Lead Volume</td><td>' + monthlyLeads.toLocaleString() + '</td></tr>' +
        '<tr><td>Current Conversion Rate</td><td>' + currentConversion + '%</td></tr>' +
        '<tr><td>Target Conversion Rate</td><td>' + targetConversion + '%</td></tr>' +
        '<tr><td>Average Deal Value</td><td>$' + avgDealValue.toLocaleString() + '</td></tr>' +
        '</table>' +
        '<h2>Annual Performance Impact</h2>' +
        '<table>' +
        '<tr><th>Metric</th><th>Current</th><th>Projected</th><th>Improvement</th></tr>' +
        '<tr><td>Annual Sales</td><td>' + currentSales.toLocaleString() + '</td><td>' + targetSales.toLocaleString() + '</td><td>' + additionalSales.toLocaleString() + '</td></tr>' +
        '<tr><td>Annual Revenue</td><td>$' + currentRevenue.toLocaleString() + '</td><td>$' + targetRevenue.toLocaleString() + '</td><td>$' + additionalRevenue.toLocaleString() + '</td></tr>' +
        '<tr class="highlight"><td>Revenue Increase</td><td colspan="3">' + percentIncrease + '%</td></tr>' +
        '</table>' +
        '<h2>Network Comparison</h2>' +
        '<p>Network Average Conversion Rate: ' + networkBenchmarks.conversionRate + '%</p>' +
        '<p>Your dealership could achieve an additional ' + 
        Math.round(annualLeads * ((networkBenchmarks.conversionRate - currentConversion) / 100)) + 
        ' sales annually by matching the network average.</p>' +
        '<p style="margin-top: 50px; font-size: 0.9em; color: #666;">' +
        'Generated by PNW Ford Lead Performance Intelligence Platform<br>' +
        new Date().toLocaleString() +
        '</p>' +
        '</body>' +
        '</html>'
    );
    
    printWindow.document.close();
    setTimeout(() => {
        printWindow.print();
        printWindow.onafterprint = function() {
            printWindow.close();
        };
    }, 250);
}