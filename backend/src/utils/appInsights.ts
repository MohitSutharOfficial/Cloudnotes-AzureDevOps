import * as appInsights from 'applicationinsights';
import { config } from '../config';

/**
 * Initialize Azure Application Insights for production monitoring
 */
export const initializeAppInsights = (): void => {
    const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

    if (!connectionString) {
        console.warn('Application Insights connection string not found. Monitoring disabled.');
        return;
    }

    if (config.nodeEnv === 'production' || config.nodeEnv === 'staging') {
        appInsights
            .setup(connectionString)
            .setAutoDependencyCorrelation(true)
            .setAutoCollectRequests(true)
            .setAutoCollectPerformance(true, true)
            .setAutoCollectExceptions(true)
            .setAutoCollectDependencies(true)
            .setAutoCollectConsole(true)
            .setUseDiskRetryCaching(true)
            .setSendLiveMetrics(true)
            .start();

        console.log('✓ Application Insights initialized');
    }
};

/**
 * Get Application Insights client for custom telemetry
 */
export const getAppInsightsClient = () => {
    return appInsights.defaultClient;
};

/**
 * Track custom event
 */
export const trackEvent = (name: string, properties?: { [key: string]: string }) => {
    if (appInsights.defaultClient) {
        appInsights.defaultClient.trackEvent({
            name,
            properties,
        });
    }
};

/**
 * Track custom metric
 */
export const trackMetric = (name: string, value: number) => {
    if (appInsights.defaultClient) {
        appInsights.defaultClient.trackMetric({
            name,
            value,
        });
    }
};

/**
 * Track dependency (external API calls, database queries)
 */
export const trackDependency = (
    name: string,
    data: string,
    duration: number,
    success: boolean
) => {
    if (appInsights.defaultClient) {
        appInsights.defaultClient.trackDependency({
            name,
            data,
            duration,
            success,
            dependencyTypeName: 'HTTP',
        });
    }
};

export default {
    initializeAppInsights,
    getAppInsightsClient,
    trackEvent,
    trackMetric,
    trackDependency,
};
