"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationLoadBalancedEc2Service = void 0;
const aws_ecs_1 = require("@aws-cdk/aws-ecs");
const application_load_balanced_service_base_1 = require("../base/application-load-balanced-service-base");
/**
 * An EC2 service running on an ECS cluster fronted by an application load balancer.
 */
class ApplicationLoadBalancedEc2Service extends application_load_balanced_service_base_1.ApplicationLoadBalancedServiceBase {
    /**
     * Constructs a new instance of the ApplicationLoadBalancedEc2Service class.
     */
    constructor(scope, id, props = {}) {
        super(scope, id, props);
        if (props.taskDefinition && props.taskImageOptions) {
            throw new Error('You must specify either a taskDefinition or taskImageOptions, not both.');
        }
        else if (props.taskDefinition) {
            this.taskDefinition = props.taskDefinition;
        }
        else if (props.taskImageOptions) {
            const taskImageOptions = props.taskImageOptions;
            this.taskDefinition = new aws_ecs_1.Ec2TaskDefinition(this, 'TaskDef', {
                executionRole: taskImageOptions.executionRole,
                taskRole: taskImageOptions.taskRole,
                family: taskImageOptions.family,
            });
            // Create log driver if logging is enabled
            const enableLogging = taskImageOptions.enableLogging !== undefined ? taskImageOptions.enableLogging : true;
            const logDriver = taskImageOptions.logDriver !== undefined
                ? taskImageOptions.logDriver : enableLogging
                ? this.createAWSLogDriver(this.node.id) : undefined;
            const containerName = taskImageOptions.containerName !== undefined ? taskImageOptions.containerName : 'web';
            const container = this.taskDefinition.addContainer(containerName, {
                image: taskImageOptions.image,
                cpu: props.cpu,
                memoryLimitMiB: props.memoryLimitMiB,
                memoryReservationMiB: props.memoryReservationMiB,
                environment: taskImageOptions.environment,
                secrets: taskImageOptions.secrets,
                logging: logDriver,
            });
            container.addPortMappings({
                containerPort: taskImageOptions.containerPort || 80,
            });
        }
        else {
            throw new Error('You must specify one of: taskDefinition or image');
        }
        this.service = new aws_ecs_1.Ec2Service(this, 'Service', {
            cluster: this.cluster,
            desiredCount: this.desiredCount,
            taskDefinition: this.taskDefinition,
            assignPublicIp: false,
            serviceName: props.serviceName,
            healthCheckGracePeriod: props.healthCheckGracePeriod,
            minHealthyPercent: props.minHealthyPercent,
            maxHealthyPercent: props.maxHealthyPercent,
            propagateTags: props.propagateTags,
            enableECSManagedTags: props.enableECSManagedTags,
            cloudMapOptions: props.cloudMapOptions,
        });
        this.addServiceAsTarget(this.service);
    }
}
exports.ApplicationLoadBalancedEc2Service = ApplicationLoadBalancedEc2Service;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbGljYXRpb24tbG9hZC1iYWxhbmNlZC1lY3Mtc2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImFwcGxpY2F0aW9uLWxvYWQtYmFsYW5jZWQtZWNzLXNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsOENBQWlFO0FBRWpFLDJHQUE2STtBQWdFN0k7O0dBRUc7QUFDSCxNQUFhLGlDQUFrQyxTQUFRLDJFQUFrQztJQVd2Rjs7T0FFRztJQUNILFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsUUFBZ0QsRUFBRTtRQUMxRixLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixJQUFJLEtBQUssQ0FBQyxjQUFjLElBQUksS0FBSyxDQUFDLGdCQUFnQixFQUFFO1lBQ2xELE1BQU0sSUFBSSxLQUFLLENBQUMseUVBQXlFLENBQUMsQ0FBQztTQUM1RjthQUFNLElBQUksS0FBSyxDQUFDLGNBQWMsRUFBRTtZQUMvQixJQUFJLENBQUMsY0FBYyxHQUFHLEtBQUssQ0FBQyxjQUFjLENBQUM7U0FDNUM7YUFBTSxJQUFJLEtBQUssQ0FBQyxnQkFBZ0IsRUFBRTtZQUNqQyxNQUFNLGdCQUFnQixHQUFHLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQztZQUNoRCxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksMkJBQWlCLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRTtnQkFDM0QsYUFBYSxFQUFFLGdCQUFnQixDQUFDLGFBQWE7Z0JBQzdDLFFBQVEsRUFBRSxnQkFBZ0IsQ0FBQyxRQUFRO2dCQUNuQyxNQUFNLEVBQUUsZ0JBQWdCLENBQUMsTUFBTTthQUNoQyxDQUFDLENBQUM7WUFFSCwwQ0FBMEM7WUFDMUMsTUFBTSxhQUFhLEdBQUcsZ0JBQWdCLENBQUMsYUFBYSxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFDM0csTUFBTSxTQUFTLEdBQUcsZ0JBQWdCLENBQUMsU0FBUyxLQUFLLFNBQVM7Z0JBQ3hELENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLGFBQWE7Z0JBQzFDLENBQUMsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1lBRXhELE1BQU0sYUFBYSxHQUFHLGdCQUFnQixDQUFDLGFBQWEsS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLGdCQUFnQixDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO1lBQzVHLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLGFBQWEsRUFBRTtnQkFDaEUsS0FBSyxFQUFFLGdCQUFnQixDQUFDLEtBQUs7Z0JBQzdCLEdBQUcsRUFBRSxLQUFLLENBQUMsR0FBRztnQkFDZCxjQUFjLEVBQUUsS0FBSyxDQUFDLGNBQWM7Z0JBQ3BDLG9CQUFvQixFQUFFLEtBQUssQ0FBQyxvQkFBb0I7Z0JBQ2hELFdBQVcsRUFBRSxnQkFBZ0IsQ0FBQyxXQUFXO2dCQUN6QyxPQUFPLEVBQUUsZ0JBQWdCLENBQUMsT0FBTztnQkFDakMsT0FBTyxFQUFFLFNBQVM7YUFDbkIsQ0FBQyxDQUFDO1lBQ0gsU0FBUyxDQUFDLGVBQWUsQ0FBQztnQkFDeEIsYUFBYSxFQUFFLGdCQUFnQixDQUFDLGFBQWEsSUFBSSxFQUFFO2FBQ3BELENBQUMsQ0FBQztTQUNKO2FBQU07WUFDTCxNQUFNLElBQUksS0FBSyxDQUFDLGtEQUFrRCxDQUFDLENBQUM7U0FDckU7UUFFRCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksb0JBQVUsQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFO1lBQzdDLE9BQU8sRUFBRSxJQUFJLENBQUMsT0FBTztZQUNyQixZQUFZLEVBQUUsSUFBSSxDQUFDLFlBQVk7WUFDL0IsY0FBYyxFQUFFLElBQUksQ0FBQyxjQUFjO1lBQ25DLGNBQWMsRUFBRSxLQUFLO1lBQ3JCLFdBQVcsRUFBRSxLQUFLLENBQUMsV0FBVztZQUM5QixzQkFBc0IsRUFBRSxLQUFLLENBQUMsc0JBQXNCO1lBQ3BELGlCQUFpQixFQUFFLEtBQUssQ0FBQyxpQkFBaUI7WUFDMUMsaUJBQWlCLEVBQUUsS0FBSyxDQUFDLGlCQUFpQjtZQUMxQyxhQUFhLEVBQUUsS0FBSyxDQUFDLGFBQWE7WUFDbEMsb0JBQW9CLEVBQUUsS0FBSyxDQUFDLG9CQUFvQjtZQUNoRCxlQUFlLEVBQUUsS0FBSyxDQUFDLGVBQWU7U0FDdkMsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUN4QyxDQUFDO0NBQ0Y7QUFuRUQsOEVBbUVDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRWMyU2VydmljZSwgRWMyVGFza0RlZmluaXRpb24gfSBmcm9tICdAYXdzLWNkay9hd3MtZWNzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ0Bhd3MtY2RrL2NvcmUnO1xuaW1wb3J0IHsgQXBwbGljYXRpb25Mb2FkQmFsYW5jZWRTZXJ2aWNlQmFzZSwgQXBwbGljYXRpb25Mb2FkQmFsYW5jZWRTZXJ2aWNlQmFzZVByb3BzIH0gZnJvbSAnLi4vYmFzZS9hcHBsaWNhdGlvbi1sb2FkLWJhbGFuY2VkLXNlcnZpY2UtYmFzZSc7XG5cbi8qKlxuICogVGhlIHByb3BlcnRpZXMgZm9yIHRoZSBBcHBsaWNhdGlvbkxvYWRCYWxhbmNlZEVjMlNlcnZpY2Ugc2VydmljZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBBcHBsaWNhdGlvbkxvYWRCYWxhbmNlZEVjMlNlcnZpY2VQcm9wcyBleHRlbmRzIEFwcGxpY2F0aW9uTG9hZEJhbGFuY2VkU2VydmljZUJhc2VQcm9wcyB7XG5cbiAgLyoqXG4gICAqIFRoZSB0YXNrIGRlZmluaXRpb24gdG8gdXNlIGZvciB0YXNrcyBpbiB0aGUgc2VydmljZS4gVGFza0RlZmluaXRpb24gb3IgVGFza0ltYWdlT3B0aW9ucyBtdXN0IGJlIHNwZWNpZmllZCwgYnV0IG5vdCBib3RoLi5cbiAgICpcbiAgICogW2Rpc2FibGUtYXdzbGludDpyZWYtdmlhLWludGVyZmFjZV1cbiAgICpcbiAgICogQGRlZmF1bHQgLSBub25lXG4gICAqL1xuICByZWFkb25seSB0YXNrRGVmaW5pdGlvbj86IEVjMlRhc2tEZWZpbml0aW9uO1xuXG4gIC8qKlxuICAgKiBUaGUgbnVtYmVyIG9mIGNwdSB1bml0cyB1c2VkIGJ5IHRoZSB0YXNrLlxuICAgKlxuICAgKiBWYWxpZCB2YWx1ZXMsIHdoaWNoIGRldGVybWluZXMgeW91ciByYW5nZSBvZiB2YWxpZCB2YWx1ZXMgZm9yIHRoZSBtZW1vcnkgcGFyYW1ldGVyOlxuICAgKlxuICAgKiAyNTYgKC4yNSB2Q1BVKSAtIEF2YWlsYWJsZSBtZW1vcnkgdmFsdWVzOiAwLjVHQiwgMUdCLCAyR0JcbiAgICpcbiAgICogNTEyICguNSB2Q1BVKSAtIEF2YWlsYWJsZSBtZW1vcnkgdmFsdWVzOiAxR0IsIDJHQiwgM0dCLCA0R0JcbiAgICpcbiAgICogMTAyNCAoMSB2Q1BVKSAtIEF2YWlsYWJsZSBtZW1vcnkgdmFsdWVzOiAyR0IsIDNHQiwgNEdCLCA1R0IsIDZHQiwgN0dCLCA4R0JcbiAgICpcbiAgICogMjA0OCAoMiB2Q1BVKSAtIEF2YWlsYWJsZSBtZW1vcnkgdmFsdWVzOiBCZXR3ZWVuIDRHQiBhbmQgMTZHQiBpbiAxR0IgaW5jcmVtZW50c1xuICAgKlxuICAgKiA0MDk2ICg0IHZDUFUpIC0gQXZhaWxhYmxlIG1lbW9yeSB2YWx1ZXM6IEJldHdlZW4gOEdCIGFuZCAzMEdCIGluIDFHQiBpbmNyZW1lbnRzXG4gICAqXG4gICAqIFRoaXMgZGVmYXVsdCBpcyBzZXQgaW4gdGhlIHVuZGVybHlpbmcgRmFyZ2F0ZVRhc2tEZWZpbml0aW9uIGNvbnN0cnVjdC5cbiAgICpcbiAgICogQGRlZmF1bHQgbm9uZVxuICAgKi9cbiAgcmVhZG9ubHkgY3B1PzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBUaGUgaGFyZCBsaW1pdCAoaW4gTWlCKSBvZiBtZW1vcnkgdG8gcHJlc2VudCB0byB0aGUgY29udGFpbmVyLlxuICAgKlxuICAgKiBJZiB5b3VyIGNvbnRhaW5lciBhdHRlbXB0cyB0byBleGNlZWQgdGhlIGFsbG9jYXRlZCBtZW1vcnksIHRoZSBjb250YWluZXJcbiAgICogaXMgdGVybWluYXRlZC5cbiAgICpcbiAgICogQXQgbGVhc3Qgb25lIG9mIG1lbW9yeUxpbWl0TWlCIGFuZCBtZW1vcnlSZXNlcnZhdGlvbk1pQiBpcyByZXF1aXJlZC5cbiAgICpcbiAgICogQGRlZmF1bHQgLSBObyBtZW1vcnkgbGltaXQuXG4gICAqL1xuICByZWFkb25seSBtZW1vcnlMaW1pdE1pQj86IG51bWJlcjtcblxuICAvKipcbiAgICogVGhlIHNvZnQgbGltaXQgKGluIE1pQikgb2YgbWVtb3J5IHRvIHJlc2VydmUgZm9yIHRoZSBjb250YWluZXIuXG4gICAqXG4gICAqIFdoZW4gc3lzdGVtIG1lbW9yeSBpcyB1bmRlciBjb250ZW50aW9uLCBEb2NrZXIgYXR0ZW1wdHMgdG8ga2VlcCB0aGVcbiAgICogY29udGFpbmVyIG1lbW9yeSB3aXRoaW4gdGhlIGxpbWl0LiBJZiB0aGUgY29udGFpbmVyIHJlcXVpcmVzIG1vcmUgbWVtb3J5LFxuICAgKiBpdCBjYW4gY29uc3VtZSB1cCB0byB0aGUgdmFsdWUgc3BlY2lmaWVkIGJ5IHRoZSBNZW1vcnkgcHJvcGVydHkgb3IgYWxsIG9mXG4gICAqIHRoZSBhdmFpbGFibGUgbWVtb3J5IG9uIHRoZSBjb250YWluZXIgaW5zdGFuY2XigJR3aGljaGV2ZXIgY29tZXMgZmlyc3QuXG4gICAqXG4gICAqIEF0IGxlYXN0IG9uZSBvZiBtZW1vcnlMaW1pdE1pQiBhbmQgbWVtb3J5UmVzZXJ2YXRpb25NaUIgaXMgcmVxdWlyZWQuXG4gICAqXG4gICAqIEBkZWZhdWx0IC0gTm8gbWVtb3J5IHJlc2VydmVkLlxuICAgKi9cbiAgcmVhZG9ubHkgbWVtb3J5UmVzZXJ2YXRpb25NaUI/OiBudW1iZXI7XG59XG5cbi8qKlxuICogQW4gRUMyIHNlcnZpY2UgcnVubmluZyBvbiBhbiBFQ1MgY2x1c3RlciBmcm9udGVkIGJ5IGFuIGFwcGxpY2F0aW9uIGxvYWQgYmFsYW5jZXIuXG4gKi9cbmV4cG9ydCBjbGFzcyBBcHBsaWNhdGlvbkxvYWRCYWxhbmNlZEVjMlNlcnZpY2UgZXh0ZW5kcyBBcHBsaWNhdGlvbkxvYWRCYWxhbmNlZFNlcnZpY2VCYXNlIHtcblxuICAvKipcbiAgICogVGhlIEVDMiBzZXJ2aWNlIGluIHRoaXMgY29uc3RydWN0LlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IHNlcnZpY2U6IEVjMlNlcnZpY2U7XG4gIC8qKlxuICAgKiBUaGUgRUMyIFRhc2sgRGVmaW5pdGlvbiBpbiB0aGlzIGNvbnN0cnVjdC5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSB0YXNrRGVmaW5pdGlvbjogRWMyVGFza0RlZmluaXRpb247XG5cbiAgLyoqXG4gICAqIENvbnN0cnVjdHMgYSBuZXcgaW5zdGFuY2Ugb2YgdGhlIEFwcGxpY2F0aW9uTG9hZEJhbGFuY2VkRWMyU2VydmljZSBjbGFzcy5cbiAgICovXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBBcHBsaWNhdGlvbkxvYWRCYWxhbmNlZEVjMlNlcnZpY2VQcm9wcyA9IHt9KSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBpZiAocHJvcHMudGFza0RlZmluaXRpb24gJiYgcHJvcHMudGFza0ltYWdlT3B0aW9ucykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdZb3UgbXVzdCBzcGVjaWZ5IGVpdGhlciBhIHRhc2tEZWZpbml0aW9uIG9yIHRhc2tJbWFnZU9wdGlvbnMsIG5vdCBib3RoLicpO1xuICAgIH0gZWxzZSBpZiAocHJvcHMudGFza0RlZmluaXRpb24pIHtcbiAgICAgIHRoaXMudGFza0RlZmluaXRpb24gPSBwcm9wcy50YXNrRGVmaW5pdGlvbjtcbiAgICB9IGVsc2UgaWYgKHByb3BzLnRhc2tJbWFnZU9wdGlvbnMpIHtcbiAgICAgIGNvbnN0IHRhc2tJbWFnZU9wdGlvbnMgPSBwcm9wcy50YXNrSW1hZ2VPcHRpb25zO1xuICAgICAgdGhpcy50YXNrRGVmaW5pdGlvbiA9IG5ldyBFYzJUYXNrRGVmaW5pdGlvbih0aGlzLCAnVGFza0RlZicsIHtcbiAgICAgICAgZXhlY3V0aW9uUm9sZTogdGFza0ltYWdlT3B0aW9ucy5leGVjdXRpb25Sb2xlLFxuICAgICAgICB0YXNrUm9sZTogdGFza0ltYWdlT3B0aW9ucy50YXNrUm9sZSxcbiAgICAgICAgZmFtaWx5OiB0YXNrSW1hZ2VPcHRpb25zLmZhbWlseSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBDcmVhdGUgbG9nIGRyaXZlciBpZiBsb2dnaW5nIGlzIGVuYWJsZWRcbiAgICAgIGNvbnN0IGVuYWJsZUxvZ2dpbmcgPSB0YXNrSW1hZ2VPcHRpb25zLmVuYWJsZUxvZ2dpbmcgIT09IHVuZGVmaW5lZCA/IHRhc2tJbWFnZU9wdGlvbnMuZW5hYmxlTG9nZ2luZyA6IHRydWU7XG4gICAgICBjb25zdCBsb2dEcml2ZXIgPSB0YXNrSW1hZ2VPcHRpb25zLmxvZ0RyaXZlciAhPT0gdW5kZWZpbmVkXG4gICAgICAgID8gdGFza0ltYWdlT3B0aW9ucy5sb2dEcml2ZXIgOiBlbmFibGVMb2dnaW5nXG4gICAgICAgICAgPyB0aGlzLmNyZWF0ZUFXU0xvZ0RyaXZlcih0aGlzLm5vZGUuaWQpIDogdW5kZWZpbmVkO1xuXG4gICAgICBjb25zdCBjb250YWluZXJOYW1lID0gdGFza0ltYWdlT3B0aW9ucy5jb250YWluZXJOYW1lICE9PSB1bmRlZmluZWQgPyB0YXNrSW1hZ2VPcHRpb25zLmNvbnRhaW5lck5hbWUgOiAnd2ViJztcbiAgICAgIGNvbnN0IGNvbnRhaW5lciA9IHRoaXMudGFza0RlZmluaXRpb24uYWRkQ29udGFpbmVyKGNvbnRhaW5lck5hbWUsIHtcbiAgICAgICAgaW1hZ2U6IHRhc2tJbWFnZU9wdGlvbnMuaW1hZ2UsXG4gICAgICAgIGNwdTogcHJvcHMuY3B1LFxuICAgICAgICBtZW1vcnlMaW1pdE1pQjogcHJvcHMubWVtb3J5TGltaXRNaUIsXG4gICAgICAgIG1lbW9yeVJlc2VydmF0aW9uTWlCOiBwcm9wcy5tZW1vcnlSZXNlcnZhdGlvbk1pQixcbiAgICAgICAgZW52aXJvbm1lbnQ6IHRhc2tJbWFnZU9wdGlvbnMuZW52aXJvbm1lbnQsXG4gICAgICAgIHNlY3JldHM6IHRhc2tJbWFnZU9wdGlvbnMuc2VjcmV0cyxcbiAgICAgICAgbG9nZ2luZzogbG9nRHJpdmVyLFxuICAgICAgfSk7XG4gICAgICBjb250YWluZXIuYWRkUG9ydE1hcHBpbmdzKHtcbiAgICAgICAgY29udGFpbmVyUG9ydDogdGFza0ltYWdlT3B0aW9ucy5jb250YWluZXJQb3J0IHx8IDgwLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignWW91IG11c3Qgc3BlY2lmeSBvbmUgb2Y6IHRhc2tEZWZpbml0aW9uIG9yIGltYWdlJyk7XG4gICAgfVxuXG4gICAgdGhpcy5zZXJ2aWNlID0gbmV3IEVjMlNlcnZpY2UodGhpcywgJ1NlcnZpY2UnLCB7XG4gICAgICBjbHVzdGVyOiB0aGlzLmNsdXN0ZXIsXG4gICAgICBkZXNpcmVkQ291bnQ6IHRoaXMuZGVzaXJlZENvdW50LFxuICAgICAgdGFza0RlZmluaXRpb246IHRoaXMudGFza0RlZmluaXRpb24sXG4gICAgICBhc3NpZ25QdWJsaWNJcDogZmFsc2UsXG4gICAgICBzZXJ2aWNlTmFtZTogcHJvcHMuc2VydmljZU5hbWUsXG4gICAgICBoZWFsdGhDaGVja0dyYWNlUGVyaW9kOiBwcm9wcy5oZWFsdGhDaGVja0dyYWNlUGVyaW9kLFxuICAgICAgbWluSGVhbHRoeVBlcmNlbnQ6IHByb3BzLm1pbkhlYWx0aHlQZXJjZW50LFxuICAgICAgbWF4SGVhbHRoeVBlcmNlbnQ6IHByb3BzLm1heEhlYWx0aHlQZXJjZW50LFxuICAgICAgcHJvcGFnYXRlVGFnczogcHJvcHMucHJvcGFnYXRlVGFncyxcbiAgICAgIGVuYWJsZUVDU01hbmFnZWRUYWdzOiBwcm9wcy5lbmFibGVFQ1NNYW5hZ2VkVGFncyxcbiAgICAgIGNsb3VkTWFwT3B0aW9uczogcHJvcHMuY2xvdWRNYXBPcHRpb25zLFxuICAgIH0pO1xuICAgIHRoaXMuYWRkU2VydmljZUFzVGFyZ2V0KHRoaXMuc2VydmljZSk7XG4gIH1cbn1cbiJdfQ==