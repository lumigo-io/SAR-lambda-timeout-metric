const AWS = require("aws-sdk");
const cloudWatchLogs = new AWS.CloudWatchLogs();
const log = require("@dazn/lambda-powertools-logger");
const retry = require("async-retry");

const bailIfErrorNotRetryable = (bail) => (error) => {
	if (!error.retryable) {
		bail(error);
	} else {
		throw error;
	}
};

const getRetryConfig = (onRetry) => (
	{
		retries: parseInt(process.env.RETRIES || "5"),
		minTimeout: parseFloat(process.env.RETRY_MIN_TIMEOUT || "5000"),
		maxTimeout: parseFloat(process.env.RETRY_MAX_TIMEOUT || "60000"),
		factor: 2,
		onRetry
	}
);

const getLogGroups = async (prefix) => {
	const loop = async (nextToken, acc = []) => {
		try {
			const resp = await retry(
				(bail) => cloudWatchLogs
					.describeLogGroups({
						logGroupNamePrefix: prefix,
						nextToken
					})
					.promise()
					.catch(bailIfErrorNotRetryable(bail)),
				getRetryConfig((err) => log.warn("retrying describeLogGroups after error...", err))
			);
      
			const logGroups = resp.logGroups.map(x => ({ 
				logGroupName: x.logGroupName
			}));
			const newAcc = acc.concat(logGroups);

			if (resp.nextToken) {
				return await loop(resp.nextToken, newAcc);
			} else {
				return newAcc;
			}
		} catch (error) {
			log.error(`failed to fetch log groups, processing the fetched groups [${acc.length}] so far`, error);
			return acc; 
		}
	};
  
	return await loop();
};

const putMetricFilter = async (logGroupName, metricNamespace, metricName) => {
	await retry(
		(bail) => cloudWatchLogs
			.putMetricFilter({
				logGroupName,
				filterName: "lambda-timeout",
				filterPattern: "Task timed out after",
				metricTransformations: [{
					metricNamespace,
					metricName,
					metricValue: "1"
				}]
			})
			.promise()
			.catch(bailIfErrorNotRetryable(bail)),
		getRetryConfig((err) => log.warn("retrying putMetricFilter after error...", { logGroupName }, err))
	)
		.then(() => log.debug(`${logGroupName}: created metric filter`, { logGroupName }))
		.catch(err => log.error(`${logGroupName}: failed to create metric filter, skipped...`, { logGroupName }, err));
};

module.exports = {
	getLogGroups,
	putMetricFilter
};
