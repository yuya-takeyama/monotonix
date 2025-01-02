import {
  DynamoDBClient,
  QueryCommandInput,
  QueryCommand,
  WriteRequest,
} from '@aws-sdk/client-dynamodb';

async function main() {
  const client = new DynamoDBClient({ region: 'ap-northeast-1' });
  const input: QueryCommandInput = {
    TableName: 'monotonix-state',
    KeyConditionExpression: 'pk = :pk AND sk >= :sk',
    FilterExpression: 'jobStatus = :success OR jobStatus = :running',
    ExpressionAttributeValues: {
      ':pk': {
        S: '[["app_path","apps/hello-world"],["job_key","dev_main"],["github_ref","refs/heads/main"]]',
      },
      ':sk': { N: '1735552256' },
      ':success': { S: 'success' },
      ':running': { S: 'running' },
    },
    ProjectionExpression: 'pk, sk, jobStatus',
  };
  const result = await client.send(new QueryCommand(input));

  console.log(JSON.stringify(result, null, 2));
}

main();
