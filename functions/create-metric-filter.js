const log = require("@dazn/lambda-powertools-logger");
const cloudWatchLogs = require("./lib/cloudwatch-logs");

const PREFIX = "/aws/lambda/";
const METRIC_NAMESPACE = "Lumigo/LambdaTimeouts";

module.exports.existingLogGroups = async () => {
	const logGroups = await cloudWatchLogs.getLogGroups(PREFIX);
	for (const { logGroupName } of logGroups) {
		const funcName = logGroupName.substr(PREFIX.length);
		await cloudWatchLogs.putMetricFilter(logGroupName, METRIC_NAMESPACE, funcName);
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
	await cloudWatchLogs.putMetricFilter(logGroupName, METRIC_NAMESPACE, funcName);
};
