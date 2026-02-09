const Queue = jest.fn(() => ({
    add: jest.fn().mockResolvedValue({ id: 'job-mock' }),
    process: jest.fn(),
    on: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    clean: jest.fn(),
    getWaitingCount: jest.fn().mockResolvedValue(0),
    getActiveCount: jest.fn().mockResolvedValue(0),
    getCompletedCount: jest.fn().mockResolvedValue(0),
    getFailedCount: jest.fn().mockResolvedValue(0),
    getCompleted: jest.fn().mockResolvedValue([]),
    getJob: jest.fn(),
    getJobs: jest.fn().mockResolvedValue([]),
    getJobCounts: jest.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0
    })
}));

module.exports = Queue;
