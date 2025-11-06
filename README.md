Полето Hours е реализирано като DECIMAL(4,2) вместо FLOAT, за да се избегнат грешки при закръгляне при работа с дробни стойности (например 0.25, 7.5, 8.00).

    // Build TimeLog query with parameters
    // We select TOP (@limit) rows ordered by WorkDate desc (most recent first)
    // If no filters are provided, returns up to LIMIT timelogs