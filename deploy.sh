#!/bin/bash

echo "Deploying to PRD"
DEPLOY_URL=s3://squarelab.co

aws s3 sync _site/ $DEPLOY_URL --delete
