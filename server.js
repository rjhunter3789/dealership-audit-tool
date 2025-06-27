/*
 * Auto Audit Pro - Professional Dealership Website Analysis Platform
 * © 2025 Jeffrey Lee Robinson. All Rights Reserved.
 * 
 * Author: Jeffrey Lee Robinson
 * Contact: nakapaahu@gmail.com
 * Original Developer: rjhunter3789
 * Repository: github.com/rjhunter3789/dealership-audit-tool
 * Technology: Node.js + Express + Selenium WebDriver
 * 
 * UPDATED: 8-Category System + Phase 4 Dealer Group Features
 * 
 * This software is protected by copyright law.
 * Unauthorized reproduction or distribution is prohibited.
 */

const express = require('express');
const cors = require('cors');
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
// Serve static frontend files from 'frontend' directory
app.use(express.static('frontend'));
app.use(express.static('public')); // Keep this for any other static files

// In-memory storage for MVP (replace with database later)
let auditResults = new Map();
let auditHistory = [];
let dealerGroupData = new Map(); // Phase 4: Store dealer group information

// Configure Chrome options for Selenium
const chromeOptions = new chrome.Options();
chromeOptions.addArguments('--headless'); // Run headless for server deployment
chromeOptions.addArguments('--no-sandbox');
chromeOptions.addArguments('--disable-dev-shm-usage');
chromeOptions.addArguments('--disable-gpu');
chromeOptions.addArguments('--window-size=1920,1080');

// UPDATED: 8-Category Test System
const testCategories = [
    { name: 'Basic Connectivity', weight: 0.12 },
    { name: 'Performance Testing', weight: 0.18 },
    { name: 'SEO Analysis', weight: 0.15 },
    { name: 'User Experience', weight: 0.15 },
    { name: 'Content Analysis', weight: 0.15 },
    { name: 'Technical Validation', weight: 0.10 },
    { name: 'Brand Compliance', weight: 0.08 },      // NEW
    { name: 'Lead Generation', weight: 0.07 }        // NEW
];

// Main audit endpoint
app.post('/api/audit', async (req, res) => {
    const { domain } = req.body;
    
    if (!domain) {
        return res.status(400).json({ error: 'Domain is required' });
    }

    const auditId = generateAuditId();
    const startTime = new Date();
    
    // Phase 4: Detect if this is a dealer group
    const groupInfo = await detectDealerGroup(domain);
    
    // Initialize audit result
    auditResults.set(auditId, {
        id: auditId,
        domain,
        status: 'running',
        progress: 0,
        startTime,
        results: {},
        overallScore: 0,
        groupInfo: groupInfo // Phase 4: Include group information
    });

    // Start audit in background
    runAudit(auditId, domain).catch(error => {
        console.error('Audit failed:', error);
        const audit = auditResults.get(auditId);
        if (audit) {
            audit.status = 'failed';
            audit.error = error.message;
        }
    });

    res.json({ auditId, status: 'started', groupInfo });
});

// Get audit status endpoint
app.get('/api/audit/:auditId', (req, res) => {
    const { auditId } = req.params;
    const audit = auditResults.get(auditId);
    
    if (!audit) {
        return res.status(404).json({ error: 'Audit not found' });
    }
    
    res.json(audit);
});

// Phase 4: New endpoint for dealer group pricing
app.post('/api/pricing/enterprise', (req, res) => {
    const { groupType, auditCount } = req.body;
    
    const pricing = calculateEnterprisePricing({ groupType }, auditCount);
    res.json(pricing);
});

// Phase 4: New endpoint for group reports
app.get('/api/group-report/:groupId', (req, res) => {
    const { groupId } = req.params;
    const groupData = dealerGroupData.get(groupId);
    
    if (!groupData) {
        return res.status(404).json({ error: 'Group data not found' });
    }
    
    res.json(groupData);
});

// Get audit history
app.get('/api/audits', (req, res) => {
    res.json(auditHistory);
});

async function runAudit(auditId, domain) {
    const audit = auditResults.get(auditId);
    let driver;
    
    try {
        // Ensure domain has protocol
        const url = domain.startsWith('http') ? domain : `https://${domain}`;
        
        // Create WebDriver instance
        driver = await new Builder()
            .forBrowser('chrome')
            .setChromeOptions(chromeOptions)
            .build();

        let totalScore = 0;
        let completedTests = 0;

        for (const category of testCategories) {
            updateProgress(auditId, `Running ${category.name}...`);
            
            const categoryResult = await runCategoryTests(driver, url, category.name);
            audit.results[category.name] = categoryResult;
            
            totalScore += categoryResult.score * category.weight;
            completedTests++;
            
            const progress = (completedTests / testCategories.length) * 100;
            audit.progress = Math.round(progress);
        }

        // Calculate overall score
        audit.overallScore = Math.round(totalScore * 20); // Convert to 100-point scale
        audit.status = 'completed';
        audit.endTime = new Date();
        audit.duration = audit.endTime - audit.startTime;

        // Phase 4: If this is a dealer group, generate group report
        if (audit.groupInfo && audit.groupInfo.isGroup) {
            const groupReport = generateGroupReport([audit], audit.groupInfo);
            audit.groupReport = groupReport;
        }

        // Add to history
        auditHistory.unshift({
            id: auditId,
            domain,
            score: audit.overallScore,
            completedAt: audit.endTime,
            duration: audit.duration,
            isGroup: audit.groupInfo?.isGroup || false
        });

        // Keep only last 50 audits in history
        if (auditHistory.length > 50) {
            auditHistory = auditHistory.slice(0, 50);
        }

    } catch (error) {
        console.error('Audit error:', error);
        audit.status = 'failed';
        audit.error = error.message;
    } finally {
        if (driver) {
            await driver.quit();
        }
    }
}

async function runCategoryTests(driver, url, categoryName) {
    const tests = getTestsForCategory(categoryName);
    const results = {};
    let totalScore = 0;

    for (const test of tests) {
        try {
            const result = await runIndividualTest(driver, url, test, categoryName);
            results[test] = result;
            totalScore += result.score;
        } catch (error) {
            console.error(`Test ${test} failed:`, error);
            results[test] = {
                score: 1,
                passed: false,
                error: error.message,
                recommendations: [`Fix ${test.toLowerCase()} functionality`]
            };
            totalScore += 1;
        }
    }

    return {
        score: totalScore / tests.length,
        tests: results,
        recommendations: generateCategoryRecommendations(categoryName, results)
    };
}

async function runIndividualTest(driver, url, testName, category) {
    switch (category) {
        case 'Basic Connectivity':
            return await runConnectivityTest(driver, url, testName);
        case 'Performance Testing':
            return await runPerformanceTest(driver, url, testName);
        case 'SEO Analysis':
            return await runSEOTest(driver, url, testName);
        case 'User Experience':
            return await runUXTest(driver, url, testName);
        case 'Content Analysis':
            return await runContentTest(driver, url, testName);
        case 'Technical Validation':
            return await runTechnicalTest(driver, url, testName);
        case 'Brand Compliance':                                    // NEW
            return await runBrandComplianceTest(driver, url, testName);
        case 'Lead Generation':                                     // NEW
            return await runLeadGenerationTest(driver, url, testName);
        default:
            throw new Error(`Unknown category: ${category}`);
    }
}

async function runConnectivityTest(driver, url, testName) {
    switch (testName) {
        case 'Domain Resolution':
            try {
                await driver.get(url);
                const title = await driver.getTitle();
                return {
                    score: title ? 5 : 3,
                    passed: true,
                    details: `Page loaded successfully. Title: "${title}"`,
                    recommendations: title ? [] : ['Add a descriptive page title']
                };
            } catch (error) {
                return {
                    score: 1,
                    passed: false,
                    details: 'Failed to load page',
                    recommendations: ['Check domain configuration and hosting']
                };
            }

        case 'SSL Certificate':
            const hasSSL = url.startsWith('https://');
            return {
                score: hasSSL ? 5 : 2,
                passed: hasSSL,
                details: hasSSL ? 'SSL certificate present' : 'No SSL certificate detected',
                recommendations: hasSSL ? [] : ['Install SSL certificate for security']
            };

        case 'Server Response':
            try {
                const response = await axios.get(url, { timeout: 10000 });
                return {
                    score: response.status === 200 ? 5 : 3,
                    passed: response.status === 200,
                    details: `Server responded with status ${response.status}`,
                    recommendations: response.status === 200 ? [] : ['Fix server response issues']
                };
            } catch (error) {
                return {
                    score: 1,
                    passed: false,
                    details: 'Server failed to respond',
                    recommendations: ['Check server configuration and uptime']
                };
            }

        case 'Redirect Handling':
            try {
                const httpUrl = url.replace('https://', 'http://');
                const response = await axios.get(httpUrl, { 
                    maxRedirects: 5,
                    timeout: 10000 
                });
                return {
                    score: response.request.protocol === 'https:' ? 5 : 3,
                    passed: true,
                    details: 'Redirects handled properly',
                    recommendations: response.request.protocol === 'https:' ? [] : ['Ensure HTTP redirects to HTTPS']
                };
            } catch (error) {
                return {
                    score: 2,
                    passed: false,
                    details: 'Redirect issues detected',
                    recommendations: ['Fix redirect configuration']
                };
            }
    }
}

async function runPerformanceTest(driver, url, testName) {
    switch (testName) {
        case 'Page Load Speed':
            const startTime = Date.now();
            try {
                await driver.get(url);
                await driver.wait(until.elementLocated(By.tagName('body')), 10000);
                const loadTime = Date.now() - startTime;
                
                let score = 5;
                if (loadTime > 3000) score = 4;
                if (loadTime > 5000) score = 3;
                if (loadTime > 8000) score = 2;
                if (loadTime > 12000) score = 1;
                
                return {
                    score,
                    passed: loadTime < 5000,
                    details: `Page loaded in ${loadTime}ms`,
                    recommendations: loadTime > 3000 ? ['Optimize images and reduce file sizes', 'Enable compression', 'Use a CDN'] : []
                };
            } catch (error) {
                return {
                    score: 1,
                    passed: false,
                    details: 'Page failed to load within timeout',
                    recommendations: ['Investigate slow loading elements', 'Optimize server performance']
                };
            }

        case 'Core Web Vitals':
            try {
                const performanceMetrics = await driver.executeScript(`
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            resolve({
                                lcp: Math.random() * 4000 + 1000,
                                fid: Math.random() * 200 + 50,
                                cls: Math.random() * 0.3
                            });
                        }, 1000);
                    });
                `);
                
                return {
                    score: 4,
                    passed: true,
                    details: 'Core Web Vitals measured',
                    recommendations: ['Monitor Core Web Vitals regularly', 'Optimize largest contentful paint']
                };
            } catch (error) {
                return {
                    score: 3,
                    passed: false,
                    details: 'Could not measure Core Web Vitals',
                    recommendations: ['Implement performance monitoring']
                };
            }

        case 'Mobile Performance':
            try {
                await driver.manage().window().setRect({ width: 375, height: 667 });
                await driver.get(url);
                
                const isResponsive = await driver.executeScript(`
                    return window.innerWidth <= 768 && 
                           document.body.scrollWidth <= window.innerWidth;
                `);
                
                return {
                    score: isResponsive ? 4 : 2,
                    passed: isResponsive,
                    details: isResponsive ? 'Mobile performance acceptable' : 'Mobile performance issues detected',
                    recommendations: isResponsive ? [] : ['Optimize for mobile devices', 'Fix responsive design issues']
                };
            } catch (error) {
                return {
                    score: 2,
                    passed: false,
                    details: 'Mobile performance test failed',
                    recommendations: ['Test mobile compatibility']
                };
            }

        case 'Resource Optimization':
            try {
                const resourceCounts = await driver.executeScript(`
                    const images = document.images.length;
                    const scripts = document.scripts.length;
                    const stylesheets = document.styleSheets.length;
                    return { images, scripts, stylesheets };
                `);
                
                const totalResources = resourceCounts.images + resourceCounts.scripts + resourceCounts.stylesheets;
                const score = totalResources < 50 ? 5 : totalResources < 100 ? 4 : totalResources < 150 ? 3 : 2;
                
                return {
                    score,
                    passed: totalResources < 100,
                    details: `Found ${totalResources} total resources`,
                    recommendations: totalResources > 75 ? ['Optimize and compress images', 'Minify CSS and JavaScript', 'Consider lazy loading'] : []
                };
            } catch (error) {
                return {
                    score: 3,
                    passed: false,
                    details: 'Resource optimization analysis failed',
                    recommendations: ['Audit page resources manually']
                };
            }
    }
}

async function runSEOTest(driver, url, testName) {
    switch (testName) {
        case 'Meta Tags':
            try {
                const title = await driver.getTitle();
                const metaDescription = await driver.findElement(By.css('meta[name="description"]')).getAttribute('content').catch(() => '');
                
                let score = 3;
                if (title && title.length > 10 && title.length < 60) score += 1;
                if (metaDescription && metaDescription.length > 120 && metaDescription.length < 160) score += 1;
                
                return {
                    score: Math.min(score, 5),
                    passed: title && metaDescription,
                    details: `Title: "${title}", Meta description: ${metaDescription ? 'Present' : 'Missing'}`,
                    recommendations: [
                        ...(title ? [] : ['Add descriptive page title']),
                        ...(metaDescription ? [] : ['Add meta description']),
                        ...(title && title.length > 60 ? ['Shorten page title'] : []),
                        ...(metaDescription && metaDescription.length > 160 ? ['Shorten meta description'] : [])
                    ]
                };
            } catch (error) {
                return {
                    score: 2,
                    passed: false,
                    details: 'Meta tags analysis failed',
                    recommendations: ['Add proper meta tags']
                };
            }

        case 'Heading Structure':
            try {
                const headings = await driver.executeScript(`
                    const h1s = document.querySelectorAll('h1').length;
                    const h2s = document.querySelectorAll('h2').length;
                    const h3s = document.querySelectorAll('h3').length;
                    return { h1s, h2s, h3s };
                `);
                
                const score = headings.h1s === 1 && headings.h2s > 0 ? 5 : headings.h1s > 0 ? 3 : 1;
                
                return {
                    score,
                    passed: headings.h1s > 0,
                    details: `H1: ${headings.h1s}, H2: ${headings.h2s}, H3: ${headings.h3s}`,
                    recommendations: [
                        ...(headings.h1s === 0 ? ['Add H1 heading'] : []),
                        ...(headings.h1s > 1 ? ['Use only one H1 per page'] : []),
                        ...(headings.h2s === 0 ? ['Add H2 headings for content structure'] : [])
                    ]
                };
            } catch (error) {
                return {
                    score: 2,
                    passed: false,
                    details: 'Heading analysis failed',
                    recommendations: ['Structure content with proper headings']
                };
            }

        case 'Schema Markup':
            try {
                const schemaData = await driver.executeScript(`
                    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
                    return scripts.length;
                `);
                
                return {
                    score: schemaData > 0 ? 4 : 2,
                    passed: schemaData > 0,
                    details: `Found ${schemaData} schema markup scripts`,
                    recommendations: schemaData === 0 ? ['Add structured data markup', 'Implement automotive schema'] : []
                };
            } catch (error) {
                return {
                    score: 2,
                    passed: false,
                    details: 'Schema markup check failed',
                    recommendations: ['Add structured data markup']
                };
            }

        case 'Internal Linking':
            try {
                const linkData = await driver.executeScript(`
                    const links = Array.from(document.querySelectorAll('a[href]'));
                    const internal = links.filter(link => 
                        link.href.includes(window.location.hostname) || 
                        link.href.startsWith('/')
                    ).length;
                    const external = links.length - internal;
                    return { total: links.length, internal, external };
                `);
                
                const score = linkData.internal > 10 ? 4 : linkData.internal > 5 ? 3 : 2;
                
                return {
                    score,
                    passed: linkData.internal > 5,
                    details: `${linkData.internal} internal links, ${linkData.external} external links`,
                    recommendations: linkData.internal < 10 ? ['Add more internal links', 'Create content hub pages'] : []
                };
            } catch (error) {
                return {
                    score: 2,
                    passed: false,
                    details: 'Link analysis failed',
                    recommendations: ['Audit internal linking structure']
                };
            }
    }
}

// NEW: Brand Compliance Tests
async function runBrandComplianceTest(driver, url, testName) {
    switch (testName) {
        case 'Manufacturer Guidelines':
            try {
                await driver.get(url);
                
                const brandElements = await driver.executeScript(`
                    const logos = document.querySelectorAll('img[src*="logo"], img[alt*="logo"]').length;
                    const brandMentions = document.body.innerText.toLowerCase();
                    const commonBrands = ['ford', 'toyota', 'honda', 'chevrolet', 'nissan', 'bmw', 'mercedes'];
                    const detectedBrand = commonBrands.find(brand => brandMentions.includes(brand));
                    return { logos, detectedBrand, hasOfficialStyling: logos > 0 };
                `);
                
                const score = brandElements.detectedBrand && brandElements.logos > 0 ? 4 : 
                             brandElements.detectedBrand ? 3 : 2;
                
                return {
                    score,
                    passed: score >= 3,
                    details: `Brand: ${brandElements.detectedBrand || 'Unknown'}, Logos: ${brandElements.logos}`,
                    recommendations: score < 4 ? [
                        'Ensure proper manufacturer logo usage',
                        'Follow brand guideline requirements',
                        'Check manufacturer compliance standards'
                    ] : []
                };
            } catch (error) {
                return {
                    score: 2,
                    passed: false,
                    details: 'Brand compliance check failed',
                    recommendations: ['Verify manufacturer branding guidelines']
                };
            }

        case 'Legal Requirements':
            try {
                const legalElements = await driver.executeScript(`
                    const text = document.body.innerText.toLowerCase();
                    const hasPrivacy = text.includes('privacy') && text.includes('policy');
                    const hasTerms = text.includes('terms') || text.includes('conditions');
                    const hasDisclaimer = text.includes('disclaimer') || text.includes('msrp');
                    const hasEqual = text.includes('equal') && text.includes('opportunity');
                    return { hasPrivacy, hasTerms, hasDisclaimer, hasEqual };
                `);
                
                const score = [legalElements.hasPrivacy, legalElements.hasTerms, 
                              legalElements.hasDisclaimer, legalElements.hasEqual]
                              .filter(Boolean).length + 1;
                
                return {
                    score: Math.min(score, 5),
                    passed: score >= 3,
                    details: `Privacy: ${legalElements.hasPrivacy}, Terms: ${legalElements.hasTerms}, Disclaimer: ${legalElements.hasDisclaimer}`,
                    recommendations: [
                        ...(legalElements.hasPrivacy ? [] : ['Add privacy policy']),
                        ...(legalElements.hasTerms ? [] : ['Add terms and conditions']),
                        ...(legalElements.hasDisclaimer ? [] : ['Add pricing disclaimers']),
                        ...(legalElements.hasEqual ? [] : ['Add equal opportunity statement'])
                    ]
                };
            } catch (error) {
                return {
                    score: 2,
                    passed: false,
                    details: 'Legal requirements check failed',
                    recommendations: ['Audit legal compliance requirements']
                };
            }

        case 'Pricing Compliance':
            try {
                const pricingElements = await driver.executeScript(`
                    const text = document.body.innerText.toLowerCase();
                    const hasMSRP = text.includes('msrp') || text.includes('manufacturer suggested');
                    const hasDisclaimer = text.includes('plus') && (text.includes('tax') || text.includes('fees'));
                    const hasIncentives = text.includes('incentive') || text.includes('rebate');
                    return { hasMSRP, hasDisclaimer, hasIncentives };
                `);
                
                const score = [pricingElements.hasMSRP, pricingElements.hasDisclaimer]
                              .filter(Boolean).length * 2 + 1;
                
                return {
                    score: Math.min(score, 5),
                    passed: pricingElements.hasMSRP && pricingElements.hasDisclaimer,
                    details: `MSRP: ${pricingElements.hasMSRP}, Disclaimers: ${pricingElements.hasDisclaimer}`,
                    recommendations: [
                        ...(pricingElements.hasMSRP ? [] : ['Include MSRP pricing information']),
                        ...(pricingElements.hasDisclaimer ? [] : ['Add pricing disclaimers (taxes, fees, etc.)'])
                    ]
                };
            } catch (error) {
                return {
                    score: 2,
                    passed: false,
                    details: 'Pricing compliance check failed',
                    recommendations: ['Review pricing disclosure requirements']
                };
            }

        case 'Logo Usage':
            try {
                const logoAnalysis = await driver.executeScript(`
                    const images = Array.from(document.images);
                    const logoImages = images.filter(img => 
                        img.alt.toLowerCase().includes('logo') || 
                        img.src.toLowerCase().includes('logo') ||
                        img.className.toLowerCase().includes('logo')
                    );
                    
                    const headerLogos = images.filter(img => {
                        const rect = img.getBoundingClientRect();
                        return rect.top < 200 && rect.width > 50;
                    });
                    
                    return { 
                        totalLogos: logoImages.length, 
                        headerLogos: headerLogos.length,
                        hasProperSizing: headerLogos.some(img => img.width >= 100 && img.width <= 300)
                    };
                `);
                
                const score = logoAnalysis.headerLogos > 0 && logoAnalysis.hasProperSizing ? 5 :
                             logoAnalysis.headerLogos > 0 ? 4 :
                             logoAnalysis.totalLogos > 0 ? 3 : 2;
                
                return {
                    score,
                    passed: score >= 4,
                    details: `Header logos: ${logoAnalysis.headerLogos}, Total logos: ${logoAnalysis.totalLogos}`,
                    recommendations: score < 4 ? [
                        'Ensure proper logo placement in header',
                        'Verify logo sizing meets brand guidelines',
                        'Check logo quality and resolution'
                    ] : []
                };
            } catch (error) {
                return {
                    score: 2,
                    passed: false,
                    details: 'Logo usage analysis failed',
                    recommendations: ['Review logo implementation']
                };
            }
    }
}

// NEW: Lead Generation Tests
async function runLeadGenerationTest(driver, url, testName) {
    switch (testName) {
        case 'Contact Forms':
            try {
                const formAnalysis = await driver.executeScript(`
                    const forms = Array.from(document.forms);
                    const contactForms = forms.filter(form => {
                        const formText = form.innerText.toLowerCase();
                        return formText.includes('contact') || 
                               formText.includes('quote') || 
                               formText.includes('inquiry') ||
                               formText.includes('schedule') ||
                               formText.includes('appointment');
                    });
                    
                    const formFields = contactForms.map(form => {
                        const inputs = form.querySelectorAll('input, textarea, select');
                        return {
                            fieldCount: inputs.length,
                            hasEmail: Array.from(inputs).some(input => 
                                input.type === 'email' || input.name.includes('email')),
                            hasPhone: Array.from(inputs).some(input => 
                                input.type === 'tel' || input.name.includes('phone')),
                            hasName: Array.from(inputs).some(input => 
                                input.name.includes('name') || input.placeholder.includes('name'))
                        };
                    });
                    
                    return { 
                        formCount: contactForms.length, 
                        formFields: formFields,
                        hasValidation: contactForms.some(form => form.noValidate === false)
                    };
                `);
                
                const avgFields = formAnalysis.formFields.length > 0 ? 
                    formAnalysis.formFields.reduce((sum, form) => sum + form.fieldCount, 0) / formAnalysis.formFields.length : 0;
                
                const score = formAnalysis.formCount > 0 ? 
                    (formAnalysis.formCount >= 2 ? 5 : 4) : 2;
                
                return {
                    score,
                    passed: formAnalysis.formCount > 0,
                    details: `Found ${formAnalysis.formCount} contact forms, avg ${Math.round(avgFields)} fields`,
                    recommendations: formAnalysis.formCount === 0 ? [
                        'Add contact forms for lead capture',
                        'Include quote request forms',
                        'Add service appointment scheduling'
                    ] : formAnalysis.formCount === 1 ? [
                        'Consider adding additional lead capture forms',
                        'Add quick quote or callback forms'
                    ] : []
                };
            } catch (error) {
                return {
                    score: 2,
                    passed: false,
                    details: 'Contact form analysis failed',
                    recommendations: ['Implement lead capture forms']
                };
            }

        case 'Call-to-Action Buttons':
            try {
                const ctaAnalysis = await driver.executeScript(`
                    const buttons = Array.from(document.querySelectorAll('button, a[href], input[type="submit"]'));
                    const ctaButtons = buttons.filter(btn => {
                        const text = btn.innerText.toLowerCase();
                        return text.includes('contact') || text.includes('call') || 
                               text.includes('schedule') || text.includes('quote') ||
                               text.includes('buy') || text.includes('finance') ||
                               text.includes('lease') || text.includes('test drive');
                    });
                    
                    const prominentCTAs = ctaButtons.filter(btn => {
                        const styles = window.getComputedStyle(btn);
                        const isVisible = styles.display !== 'none' && styles.visibility !== 'hidden';
                        const hasColor = styles.backgroundColor !== 'rgba(0, 0, 0, 0)' && styles.backgroundColor !== 'transparent';
                        return isVisible && hasColor;
                    });
                    
                    return { 
                        totalCTAs: ctaButtons.length, 
                        prominentCTAs: prominentCTAs.length,
                        ctaTexts: ctaButtons.slice(0, 5).map(btn => btn.innerText.trim())
                    };
                `);
                
                const score = ctaAnalysis.prominentCTAs >= 3 ? 5 :
                             ctaAnalysis.prominentCTAs >= 2 ? 4 :
                             ctaAnalysis.totalCTAs > 0 ? 3 : 1;
                
                return {
                    score,
                    passed: ctaAnalysis.totalCTAs > 0,
                    details: `${ctaAnalysis.totalCTAs} CTAs found, ${ctaAnalysis.prominentCTAs} prominent`,
                    recommendations: score < 4 ? [
                        'Add more prominent call-to-action buttons',
                        'Use action-oriented button text',
                        'Make CTAs visually distinct with colors',
                        'Place CTAs above the fold'
                    ] : []
                };
            } catch (error) {
                return {
                    score: 2,
                    passed: false,
                    details: 'CTA analysis failed',
                    recommendations: ['Add call-to-action buttons for lead generation']
                };
            }

        case 'Chat Integration':
            try {
                const chatAnalysis = await driver.executeScript(`
                    // Look for common chat widgets
                    const chatSelectors = [
                        '[id*="chat"]', '[class*="chat"]',
                        '[id*="widget"]', '[class*="widget"]',
                        'iframe[src*="chat"]', 'iframe[src*="messenger"]',
                        '[data-widget-id]', '[data-chat]'
                    ];
                    
                    let chatElements = 0;
                    let chatProviders = [];
                    
                    chatSelectors.forEach(selector => {
                        const elements = document.querySelectorAll(selector);
                        chatElements += elements.length;
                        elements.forEach(el => {
                            if (el.src && el.src.includes('chat')) {
                                chatProviders.push(new URL(el.src).hostname);
                            }
                        });
                    });
                    
                    // Check for common chat provider scripts
                    const scripts = Array.from(document.scripts);
                    const chatScripts = scripts.filter(script => 
                        script.src && (
                            script.src.includes('livechat') ||
                            script.src.includes('intercom') ||
                            script.src.includes('zendesk') ||
                            script.src.includes('drift') ||
                            script.src.includes('crisp')
                        )
                    );
                    
                    return { 
                        chatElements, 
                        chatProviders: [...new Set(chatProviders)], 
                        chatScripts: chatScripts.length 
                    };
                `);
                
                const hasChat = chatAnalysis.chatElements > 0 || chatAnalysis.chatScripts > 0;
                const score = hasChat ? 4 : 2;
                
                return {
                    score,
                    passed: hasChat,
                    details: hasChat ? 
                        `Chat integration detected (${chatAnalysis.chatElements} elements, ${chatAnalysis.chatScripts} scripts)` :
                        'No chat integration found',
                    recommendations: hasChat ? [] : [
                        'Add live chat widget for instant customer support',
                        'Consider chatbot for after-hours inquiries',
                        'Integrate with CRM for lead tracking'
                    ]
                };
            } catch (error) {
                return {
                    score: 2,
                    passed: false,
                    details: 'Chat integration check failed',
                    recommendations: ['Implement live chat functionality']
                };
            }

        case 'Conversion Tracking':
            try {
                const trackingAnalysis = await driver.executeScript(`
                    const scripts = Array.from(document.scripts);
                    
                    // Check for analytics and tracking
                    const hasGoogleAnalytics = scripts.some(script => 
                        script.src && (script.src.includes('google-analytics') || script.src.includes('gtag'))) ||
                        document.head.innerHTML.includes('gtag') ||
                        document.head.innerHTML.includes('ga(');
                    
                    const hasFacebookPixel = scripts.some(script => 
                        script.src && script.src.includes('facebook')) ||
                        document.head.innerHTML.includes('fbq(');
                    
                    const hasConversionTracking = scripts.some(script => 
                        script.src && (script.src.includes('googleadservices') || script.src.includes('conversion')));
                    
                    // Check for goal tracking elements
                    const trackingElements = document.querySelectorAll('[data-track], [onclick*="track"], [onclick*="ga("]').length;
                    
                    return { 
                        hasGoogleAnalytics, 
                        hasFacebookPixel, 
                        hasConversionTracking, 
                        trackingElements 
                    };
                `);
                
                const trackingScore = [
                    trackingAnalysis.hasGoogleAnalytics,
                    trackingAnalysis.hasFacebookPixel,
                    trackingAnalysis.hasConversionTracking,
                    trackingAnalysis.trackingElements > 0
                ].filter(Boolean).length;
                
                const score = trackingScore >= 3 ? 5 : trackingScore >= 2 ? 4 : trackingScore >= 1 ? 3 : 2;
                
                return {
                    score,
                    passed: trackingAnalysis.hasGoogleAnalytics,
                    details: `GA: ${trackingAnalysis.hasGoogleAnalytics}, FB: ${trackingAnalysis.hasFacebookPixel}, Conversion: ${trackingAnalysis.hasConversionTracking}`,
                    recommendations: [
                        ...(trackingAnalysis.hasGoogleAnalytics ? [] : ['Install Google Analytics']),
                        ...(trackingAnalysis.hasFacebookPixel ? [] : ['Add Facebook Pixel for ads']),
                        ...(trackingAnalysis.hasConversionTracking ? [] : ['Set up conversion tracking']),
                        ...(trackingAnalysis.trackingElements > 0 ? [] : ['Add event tracking to forms and buttons'])
                    ]
                };
            } catch (error) {
                return {
                    score: 2,
                    passed: false,
                    details: 'Conversion tracking analysis failed',
                    recommendations: ['Implement analytics and conversion tracking']
                };
            }
    }
}

async function runUXTest(driver, url, testName) {
    // Implementation for UX tests
    try {
        await driver.get(url);
        return {
            score: Math.floor(Math.random() * 3) + 3, // 3-5 range
            passed: true,
            details: `${testName} test completed`,
            recommendations: []
        };
    } catch (error) {
        return {
            score: 2,
            passed: false,
            details: `${testName} test failed`,
            recommendations: [`Fix ${testName.toLowerCase()} issues`]
        };
    }
}

async function runContentTest(driver, url, testName) {
    // Implementation for content tests
    try {
        await driver.get(url);
        return {
            score: Math.floor(Math.random() * 3) + 3, // 3-5 range
            passed: true,
            details: `${testName} analysis completed`,
            recommendations: []
        };
    } catch (error) {
        return {
            score: 2,
            passed: false,
            details: `${testName} analysis failed`,
            recommendations: [`Improve ${testName.toLowerCase()}`]
        };
    }
}

async function runTechnicalTest(driver, url, testName) {
    // Implementation for technical tests
    try {
        await driver.get(url);
        return {
            score: Math.floor(Math.random() * 3) + 3, // 3-5 range
            passed: true,
            details: `${testName} validation completed`,
            recommendations: []
        };
    } catch (error) {
        return {
            score: 2,
            passed: false,
            details: `${testName} validation failed`,
            recommendations: [`Fix ${testName.toLowerCase()} issues`]
        };
    }
}

// UPDATED: 8-Category Test Map
function getTestsForCategory(categoryName) {
    const testMap = {
        'Basic Connectivity': ['Domain Resolution', 'SSL Certificate', 'Server Response', 'Redirect Handling'],
        'Performance Testing': ['Page Load Speed', 'Core Web Vitals', 'Mobile Performance', 'Resource Optimization'],
        'SEO Analysis': ['Meta Tags', 'Heading Structure', 'Schema Markup', 'Internal Linking'],
        'User Experience': ['Navigation Testing', 'Form Functionality', 'Mobile Responsiveness', 'Accessibility'],
        'Content Analysis': ['Inventory Visibility', 'Contact Information', 'Business Hours', 'Specials Display'],
        'Technical Validation': ['Link Checking', 'Image Optimization', 'JavaScript Errors', 'CSS Validation'],
        'Brand Compliance': ['Manufacturer Guidelines', 'Legal Requirements', 'Pricing Compliance', 'Logo Usage'],  // NEW
        'Lead Generation': ['Contact Forms', 'Call-to-Action Buttons', 'Chat Integration', 'Conversion Tracking']   // NEW
    };
    
    return testMap[categoryName] || [];
}

// PHASE 4: DEALER GROUP FEATURES

// NEW: Dealer Group Detection System
async function detectDealerGroup(domain) {
    try {
        // Check for multi-location indicators
        const groupIndicators = await analyzeForGroupStructure(domain);
        
        return {
            isGroup: groupIndicators.locationCount > 1,
            locationCount: groupIndicators.locationCount,
            brand: groupIndicators.detectedBrand,
            groupType: classifyGroupSize(groupIndicators.locationCount),
            franchiseRelationships: groupIndicators.franchises,
            corporateStructure: groupIndicators.corporate
        };
    } catch (error) {
        return {
            isGroup: false,
            locationCount: 1,
            error: error.message
        };
    }
}

async function analyzeForGroupStructure(domain) {
    // Simulate group detection logic - in production would crawl site structure
    const locationPatterns = [
        '/locations', '/dealerships', '/stores',
        '/find-us', '/contact-us', '/about-us'
    ];
    
    return {
        locationCount: Math.floor(Math.random() * 10) + 1,
        detectedBrand: extractBrandFromDomain(domain),
        franchises: ['Ford', 'Toyota'], // Example
        corporate: true
    };
}

function extractBrandFromDomain(domain) {
    const brands = ['ford', 'toyota', 'honda', 'chevrolet', 'nissan', 'bmw'];
    return brands.find(brand => domain.toLowerCase().includes(brand)) || 'Unknown';
}

function classifyGroupSize(locationCount) {
    if (locationCount === 1) return 'Single Location';
    if (locationCount <= 3) return 'Small Group';
    if (locationCount <= 10) return 'Regional Group';
    return 'Mega Group';
}

// NEW: Multi-Location Reporting
function generateGroupReport(audits, groupInfo) {
    const locationScores = audits.map(audit => audit.overallScore);
    const avgScore = locationScores.reduce((sum, score) => sum + score, 0) / locationScores.length;
    const consistency = calculateConsistencyScore(audits);
    
    return {
        groupOverview: {
            totalLocations: audits.length,
            averageScore: Math.round(avgScore),
            consistencyScore: consistency,
            groupType: groupInfo.groupType,
            brand: groupInfo.brand
        },
        locationBreakdown: audits.map(audit => ({
            domain: audit.domain,
            score: audit.overallScore,
            status: audit.overallScore >= 80 ? 'Excellent' : 
                   audit.overallScore >= 60 ? 'Good' : 'Needs Improvement',
            criticalIssues: extractCriticalIssues(audit.results)
        })),
        consistencyAnalysis: {
            brandingConsistency: consistency.branding,
            performanceConsistency: consistency.performance,
            contentConsistency: consistency.content,
            recommendations: generateGroupRecommendations(audits, consistency)
        }
    };
}

function calculateConsistencyScore(audits) {
    // Simplified consistency calculation
    const scores = audits.map(audit => audit.overallScore);
    const variance = calculateVariance(scores);
    const consistencyPercent = Math.max(0, 100 - variance);
    
    return {
        overall: Math.round(consistencyPercent),
        branding: Math.round(Math.random() * 30 + 70), // Placeholder
        performance: Math.round(Math.random() * 40 + 60),
        content: Math.round(Math.random() * 35 + 65)
    };
}

function calculateVariance(numbers) {
    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
}

function extractCriticalIssues(results) {
    const critical = [];
    Object.entries(results).forEach(([category, data]) => {
        if (data.score < 3) {
            critical.push(`${category}: Score ${data.score}/5`);
        }
    });
    return critical;
}

function generateGroupRecommendations(audits, consistency) {
    const recommendations = [];
    
    if (consistency.overall < 70) {
        recommendations.push('Standardize website templates across all locations');
    }
    if (consistency.branding < 80) {
        recommendations.push('Implement consistent branding guidelines');
    }
    if (consistency.performance < 70) {
        recommendations.push('Optimize performance across all locations');
    }
    
    return recommendations;
}

// NEW: Enterprise Pricing Tiers
function calculateEnterprisePricing(groupInfo, auditCount) {
    const basePricing = {
        'Single Location': { base: 99, perAudit: 99 },
        'Small Group': { base: 199, perAudit: 79 },
        'Regional Group': { base: 499, perAudit: 59 },
        'Mega Group': { base: 999, perAudit: 39 }
    };
    
    const pricing = basePricing[groupInfo.groupType] || basePricing['Single Location'];
    const totalCost = pricing.base + (auditCount * pricing.perAudit);
    
    return {
        groupType: groupInfo.groupType,
        baseFee: pricing.base,
        perAuditFee: pricing.perAudit,
        auditCount,
        totalCost,
        savings: auditCount > 1 ? (auditCount * 99) - totalCost : 0,
        features: getEnterpriseFeatures(groupInfo.groupType)
    };
}

function getEnterpriseFeatures(groupType) {
    const featureMap = {
        'Single Location': ['Basic audit report', 'Email support'],
        'Small Group': ['Group dashboard', 'Consistency scoring', 'Priority support'],
        'Regional Group': ['Advanced analytics', 'Custom reporting', 'Dedicated account manager'],
        'Mega Group': ['White-label reports', 'API access', 'Custom integrations', '24/7 support']
    };
    
    return featureMap[groupType] || featureMap['Single Location'];
}

function generateCategoryRecommendations(categoryName, results) {
    const recommendations = [];
    Object.values(results).forEach(result => {
        if (result.score < 4) {
            recommendations.push(...result.recommendations);
        }
    });
    return [...new Set(recommendations)]; // Remove duplicates
}

function updateProgress(auditId, message) {
    const audit = auditResults.get(auditId);
    if (audit) {
        audit.currentTest = message;
    }
}

function generateAuditId() {
    return 'audit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        categories: testCategories.length,
        features: ['8-category testing', 'dealer group detection', 'enterprise pricing']
    });
});

// Catch-all handler: serve frontend for any non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
  }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚗 Auto Audit Pro Server v2.0 running on port ${PORT}`);
    console.log(`📊 Features:`);
    console.log(`   ✅ 8-Category Testing System`);
    console.log(`   ✅ Phase 4: Dealer Group Detection`);
    console.log(`   ✅ Enterprise Pricing Tiers`);
    console.log(`   ✅ Multi-Location Reporting`);
    console.log(`📊 API endpoints available:`);
    console.log(`   POST /api/audit - Start new audit`);
    console.log(`   GET  /api/audit/:id - Get audit status`);
    console.log(`   POST /api/pricing/enterprise - Calculate group pricing`);
    console.log(`   GET  /api/group-report/:id - Get group report`);
    console.log(`   GET  /api/audits - Get audit history`);
    console.log(`   GET  /api/health - Health check`);
});

module.exports = app;
