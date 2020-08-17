# lambda-timeout-metric

[![License](https://img.shields.io/badge/License-Apache%200.2.0-blue.svg)](LICENSE)

A [Serverless Application Repository](https://serverlessrepo.aws.amazon.com) app that automatically create timeout metrics for Lambda functions using CloudWatch metric filters.

## Deploying to your account (via the console)

Go to this [page](https://serverlessrepo.aws.amazon.com/applications/arn:aws:serverlessrepo:us-east-1:374852340823:applications~lambda-timeout-metric) and click the Deploy button.

## Deploying via SAM/Serverless framework/CloudFormation

To deploy this via SAM, you need something like this in the CloudFormation template:

```yml
AutoSetLogRetention:
  Type: AWS::Serverless::Application
  Properties:
    Location:
      ApplicationId: arn:aws:serverlessrepo:us-east-1:374852340823:applications/lambda-timeout-metric
      SemanticVersion: <enter latest version>
```

To do the same via `CloudFormation` or the `Serverless` framework, you need to first add the following `Transform`:

```yml
Transform: AWS::Serverless-2016-10-31
```

For more details, read this [post](https://theburningmonk.com/2019/05/how-to-include-serverless-repository-apps-in-serverless-yml/).
