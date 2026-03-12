import Audit from './audit.model.js';

export const getAuditLogs = async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const parsedPage = parseInt(page);
        const parsedLimit = parseInt(limit);

        const logs = await Audit.find()
            .limit(parsedLimit)
            .skip((parsedPage - 1) * parsedLimit)
            .sort({ createdAt: -1 });

        const total = await Audit.countDocuments();

        res.status(200).json({
            success: true,
            data: logs,
            pagination: {
                currentPage: parsedPage,
                totalPages: Math.ceil(total / parsedLimit),
                totalRecords: total,
                limit: parsedLimit
            }
        });
    } catch (error) {
        next(error);
    }
};