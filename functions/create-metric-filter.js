const log = require("@dazn/lambda-powertools-logger");
const cloudWatchLogs = require("./lib/cloudwatch-logs");

const PREFIX = "/aws/lambda/";
const METRIC_NAMESPACE = "AWS/Lambda";
const METRIC_NAME_SUFFIX = "TimeOuts";

const toMetricName = funcName => {
	const funcNameParts = funcName.split(/[-_]/);
	return [ ...funcNameParts, METRIC_NAME_SUFFIX ]
		.map(([h, ...t]) => [h.toUpperCase(), ...t].join(""))  // make TitleCase
		.join("");
};

module.exports.existingLogGroups = async () => {
	const logGroups = await cloudWatchLogs.getLogGroups(PREFIX);
	for (const { logGroupName } of logGroups) {
		const funcName = logGroupName.substr(PREFIX.length);
		const metricName = toMetricName(funcName);
		await cloudWatchLogs.putMetricFilter(logGroupName, METRIC_NAMESPACE, metricName);
	}
};

module.exports.newLogGroups = async (event) => {
	log.debug("processing new log group...", { event });
  
	const logGroupName = event.detail.requestParameters.logGroupName;
	if (!logGroupName.startsWith(PREFIX)) {
		log.debug("not a Lambda log group, skipped");
		return;
	}
  
	const funcName = logGroupName.substr(PREFIX.length);
	const metricName = toMetricName(funcName);
	await cloudWatchLogs.putMetricFilter(logGroupName, METRIC_NAMESPACE, metricName);
};
