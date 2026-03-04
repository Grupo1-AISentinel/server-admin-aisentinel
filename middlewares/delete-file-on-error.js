export const cleanUploaderFileOnFinish = (req, res, next) => {
    next();
}

export const deleteFileOnError = async(err, req, res, next) => {
    return next(err);
}