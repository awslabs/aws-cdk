from typing import Dict
import unittest
import uuid
import os
import sys
from unittest.mock import MagicMock, patch

# boto needs a region to initialize the client
# even if no calls are executed.
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

try:
    # this is available only if executed with ./test.sh
    import index
except ModuleNotFoundError as _:
    print(
        "Unable to import index. Use ./test.sh to run these tests. "
        + 'If you want to avoid running them in docker, run "NOTIFICATIONS_RESOURCE_TEST_NO_DOCKER=true ./test.sh"'
    )
    sys.exit(1)

CONFIGURATION_TYPES = ["TopicConfigurations", "QueueConfigurations", "LambdaFunctionConfigurations"]


def make_event(request_type: str, managed: bool):
    return {
        "StackId": "StackId",
        "RequestType": request_type,
        "ResourceProperties": {
            "Managed": str(managed),
            "BucketName": "BucketName",
            "NotificationConfiguration": make_notification_configuration(),
        },
    }


def make_notification_configuration(id_prefix: str = None):
    def make_id():
        return f"{id_prefix or ''}{str(uuid.uuid4())}"

    config = {}
    for t in CONFIGURATION_TYPES:
        config[t] = [{"Id": make_id()}]
    return config


def make_empty_notification_configuration():
    config = {}
    for t in CONFIGURATION_TYPES:
        config[t] = []
    return config


def merge_notification_configurations(conf1: Dict, conf2: Dict):
    notifications = {}
    for t in CONFIGURATION_TYPES:
        notifications[t] = conf1.get(t, []) + conf2.get(t, [])
    return notifications


class ManagedBucketTest(unittest.TestCase):
    @patch("index.put_bucket_notification_configuration")
    @patch("index.submit_response")
    def test_create(self, _, put: MagicMock):

        event = make_event("Create", True)

        index.handler(event, {})

        put.assert_called_once_with(
            event["ResourceProperties"]["BucketName"],
            event["ResourceProperties"]["NotificationConfiguration"],
        )

    @patch("index.put_bucket_notification_configuration")
    @patch("index.submit_response")
    def test_update(self, _, put):

        event = make_event("Update", True)

        index.handler(event, {})

        put.assert_called_once_with(
            event["ResourceProperties"]["BucketName"],
            event["ResourceProperties"]["NotificationConfiguration"],
        )

    @patch("index.put_bucket_notification_configuration")
    @patch("index.submit_response")
    def test_delete(self, _, put: MagicMock):

        event = make_event("Delete", True)

        index.handler(event, {})

        put.assert_called_once_with(event["ResourceProperties"]["BucketName"], {})


class UnmanagedCleanBucketTest(unittest.TestCase):
    @patch("index.put_bucket_notification_configuration")
    @patch("index.get_bucket_notification_configuration")
    @patch("index.submit_response")
    def test_create(self, _, get: MagicMock, put: MagicMock):

        get.return_value = {}

        event = make_event("Create", False)

        index.handler(event, {})

        put.assert_called_once_with(
            event["ResourceProperties"]["BucketName"],
            event["ResourceProperties"]["NotificationConfiguration"],
        )

    @patch("index.put_bucket_notification_configuration")
    @patch("index.get_bucket_notification_configuration")
    @patch("index.submit_response")
    def test_update(self, _, get: MagicMock, put: MagicMock):

        event = make_event("Update", False)

        # simulate a previous create operation
        current_notifications = make_notification_configuration(f"{event['StackId']}-")
        get.return_value = current_notifications

        index.handler(event, {})

        put.assert_called_once_with(
            event["ResourceProperties"]["BucketName"],
            event["ResourceProperties"]["NotificationConfiguration"],
        )

    @patch("index.put_bucket_notification_configuration")
    @patch("index.get_bucket_notification_configuration")
    @patch("index.submit_response")
    def test_delete(self, _, get: MagicMock, put: MagicMock):

        event = make_event("Delete", False)

        # simulate a previous create operation
        current_notifications = make_notification_configuration(f"{event['StackId']}-")
        get.return_value = current_notifications

        index.handler(event, {})

        put.assert_called_once_with(
            event["ResourceProperties"]["BucketName"],
            make_empty_notification_configuration(),
        )


class UnmanagedDirtyBucketTest(unittest.TestCase):
    @patch("index.put_bucket_notification_configuration")
    @patch("index.get_bucket_notification_configuration")
    @patch("index.submit_response")
    def test_create(self, _, get: MagicMock, put: MagicMock):

        event = make_event("Create", False)

        # simulate external notifications
        current_notifications = make_notification_configuration()
        get.return_value = current_notifications

        index.handler(event, {})

        put.assert_called_once_with(
            event["ResourceProperties"]["BucketName"],
            merge_notification_configurations(
                current_notifications,
                event["ResourceProperties"]["NotificationConfiguration"],
            ),
        )

    @patch("index.put_bucket_notification_configuration")
    @patch("index.get_bucket_notification_configuration")
    @patch("index.submit_response")
    def test_update(self, _, get: MagicMock, put: MagicMock):

        event = make_event("Update", False)

        # simulate external notifications
        current_notifications = make_notification_configuration()
        get.return_value = current_notifications

        index.handler(event, {})

        put.assert_called_once_with(
            event["ResourceProperties"]["BucketName"],
            merge_notification_configurations(
                current_notifications,
                event["ResourceProperties"]["NotificationConfiguration"],
            ),
        )

    @patch("index.put_bucket_notification_configuration")
    @patch("index.get_bucket_notification_configuration")
    @patch("index.submit_response")
    def test_delete(self, _, get: MagicMock, put: MagicMock):

        event = make_event("Delete", False)

        # simulate external notifications
        current_notifications = make_notification_configuration()
        get.return_value = current_notifications

        index.handler(event, {})

        put.assert_called_once_with(
            event["ResourceProperties"]["BucketName"],
            current_notifications,
        )


class CfnResponsesTest(unittest.TestCase):
    @patch("index.put_bucket_notification_configuration")
    @patch("index.handle_managed")
    @patch("index.submit_response")
    def test_success(self, submit: MagicMock, *_):

        event = make_event("Create", True)

        index.handler(event, {})

        submit.assert_called_once()
        self.assertEqual(submit.call_args_list[0][0][2], "SUCCESS")

    @patch("index.handle_managed")
    @patch("index.submit_response")
    def test_failure(self, submit: MagicMock, handle_managed: MagicMock):

        event = make_event("Create", True)

        def throw(*_):
            raise RuntimeError("Intentional error for test")

        handle_managed.side_effect = throw

        index.handler(event, {})

        submit.assert_called_once()
        self.assertEqual(submit.call_args_list[0][0][2], "FAILED")


if __name__ == "__main__":
    unittest.main()
