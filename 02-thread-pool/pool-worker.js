module.exports = (data) => {
    let counter = 0;
    // Doing the same heavy lifting, divided by the thread count
    for(let i = 0; i < 20000000 / data.thread_count; i++) {
        counter++;
    }
    return counter;
};
