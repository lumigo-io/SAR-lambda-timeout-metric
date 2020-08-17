const AWS = require("aws-sdk");

const mockPutMetricFilter = jest.fn();
AWS.CloudWatchLogs.prototype.putMetricFilter = mockPutMetricFilter;
const mockDescribeLogGroups = jest.fn();
AWS.CloudWatchLogs.prototype.describeLogGroups = mockDescribeLogGroups;

console.debug = jest.fn();
console.warn = jest.fn();
console.error = jest.fn();

beforeEach(() => {
	process.env.RETRY_MIN_TIMEOUT = "100";
	process.env.RETRY_MAX_TIMEOUT = "100";
  
	mockPutMetricFilter.mockReturnValue({
		promise: () => Promise.resolve()
	});
});

afterEach(() => {
	mockPutMetricFilter.mockReset();
	mockDescribeLogGroups.mockReset();
});

describe("new log group", () => {
	const handler = require("./create-metric-filter").newLogGroups;
  
	test("non-lambda log group is skipped", async () => {
		const event = {
			detail: {
				requestParameters: {
					logGroupName: "some-other-log"
				}
			}
		};
		await handler(event);
    
		expect(mockPutMetricFilter).not.toBeCalled();
	});

	test("metric filter is created", async () => {
		const event = {
			detail: {
				requestParameters: {
					logGroupName: "/aws/lambda/my-function_name"
				}
			}
		};
		await handler(event);

		expect(mockPutMetricFilter).toBeCalledWith({
			logGroupName: "/aws/lambda/my-function_name",
			filterName: "lambda-timeout",
			filterPattern: "Task timed out after",
			metricTransformations: [{
				metricNamespace: "Lumigo/Lambda",
				metricName: "MyFunctionNameTimeOuts",
				metricValue: "1"
			}]
		});
	});
});

describe("existing log groups", () => {
	const handler = require("./create-metric-filter").existingLogGroups;

	test("metric filter created for all log groups", async () => {
		givenDescribeLogGroupsReturns([
			{
				logGroupName: "/aws/lambda/group-1"
			}, {
				logGroupName: "/aws/lambda/group_2"
			}],
		true);
		givenDescribeLogGroupsReturns([
			{
				logGroupName: "/aws/lambda/group-3"
			}
		]);

		await handler();

		expect(mockPutMetricFilter).toHaveBeenCalledTimes(3);
		expect(mockPutMetricFilter).toBeCalledWith({
			logGroupName: "/aws/lambda/group-1",
			filterName: "lambda-timeout",
			filterPattern: "Task timed out after",
			metricTransformations: [{
				metricNamespace: "Lumigo/Lambda",
				metricName: "Group1TimeOuts",
				metricValue: "1"
			}]
		});
		expect(mockPutMetricFilter).toBeCalledWith({
			logGroupName: "/aws/lambda/group_2",
			filterName: "lambda-timeout",
			filterPattern: "Task timed out after",
			metricTransformations: [{
				metricNamespace: "Lumigo/Lambda",
				metricName: "Group2TimeOuts",
				metricValue: "1"
			}]
		});
		expect(mockPutMetricFilter).toBeCalledWith({
			logGroupName: "/aws/lambda/group-3",
			filterName: "lambda-timeout",
			filterPattern: "Task timed out after",
			metricTransformations: [{
				metricNamespace: "Lumigo/Lambda",
				metricName: "Group3TimeOuts",
				metricValue: "1"
			}]
		});
	});
  
	describe("error handling", () => {
		beforeEach(() => {
			mockPutMetricFilter.mockReset();  
		});
    
		test("it should retry retryable errors when listing log groups", async () => {
			givenDescribeLogGroupsFailsWith("ThrottlingException", "Rate exceeded");
			givenDescribeLogGroupsReturns([]);
  
			await handler();
  
			expect(mockDescribeLogGroups).toBeCalledTimes(2);
		});
    
		test("it should not retry non-retryable errors when listing log groups", async () => {
			givenDescribeLogGroupsFailsWith("Foo", "Bar", false);
  
			await handler();
  
			expect(mockDescribeLogGroups).toBeCalledTimes(1);
		});
    
		test("it should retry retryable errors when putting retention policy", async () => {
			givenDescribeLogGroupsReturns([{
				logGroupName: "/aws/lambda/group-1"
			}]);
      
			givenPutMetricFilterFailsWith("ThrottlingException", "Rate exceeded");
			givenPutMetricFilterSucceeds();
  
			await expect(handler()).resolves.toEqual(undefined);
  
			expect(mockPutMetricFilter).toBeCalledTimes(2);
		});
    
		test("it should not retry non-retryable errors when putting retention policy", async () => {
			givenDescribeLogGroupsReturns([{
				logGroupName: "/aws/lambda/group-1"
			}]);
      
			givenPutMetricFilterFailsWith("Foo", "Bar", false);
  
			await expect(handler()).resolves.toEqual(undefined);
  
			expect(mockPutMetricFilter).toBeCalledTimes(1);
		});
	});
});

const givenDescribeLogGroupsReturns = (logGroups, hasMore = false) => {
	mockDescribeLogGroups.mockReturnValueOnce({
		promise: () => Promise.resolve({
			logGroups: logGroups,
			nextToken: hasMore ? "more" : undefined
		})
	});
};

const givenDescribeLogGroupsFailsWith = (code, message, retryable = true) => {
	mockDescribeLogGroups.mockReturnValueOnce({
		promise: () => Promise.reject(new AwsError(code, message, retryable))
	});
};

const givenPutMetricFilterSucceeds = () => {
	mockPutMetricFilter.mockReturnValueOnce({
		promise: () => Promise.resolve()
	});
};

const givenPutMetricFilterFailsWith = (code, message, retryable = true) => {
	mockPutMetricFilter.mockReturnValueOnce({
		promise: () => Promise.reject(new AwsError(code, message, retryable))
	});
};

class AwsError extends Error {
	constructor (code, message, retryable) {
		super(message);

		this.code = code;
		this.retryable = retryable;
	}
}
