SET NOCOUNT ON;
GO

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'dbo') BEGIN
    PRINT 'dbo schema exists by default';
END

IF OBJECT_ID('dbo.[User]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[User] (
        id INT IDENTITY(1,1) PRIMARY KEY,
        firstName VARCHAR(100) NOT NULL,
        lastName  VARCHAR(100) NOT NULL,
        email     VARCHAR(256) NOT NULL UNIQUE
    );
END

IF OBJECT_ID('dbo.Project', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Project (
        id INT IDENTITY(1,1) PRIMARY KEY,
        [name] NVARCHAR(200) NOT NULL
    );
END

IF OBJECT_ID('dbo.TimeLog', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TimeLog (
        id INT IDENTITY(1,1) PRIMARY KEY,
        userId INT NOT NULL,
        projectId INT NOT NULL,
        workDate DATE NOT NULL,
        hours DECIMAL(4,2) NOT NULL, -- <= 99.99  0.25..8.00 FLOAT
        CONSTRAINT FK_TimeLog_User FOREIGN KEY (userId) REFERENCES dbo.[User](id) ON DELETE CASCADE,
        CONSTRAINT FK_TimeLog_Project FOREIGN KEY (projectId) REFERENCES dbo.Project(id) ON DELETE CASCADE
    );
END
GO

IF OBJECT_ID('dbo.ChronoLog', 'U') IS NOT NULL
    DROP TABLE dbo.ChronoLog;
GO

CREATE TABLE dbo.ChronoLog (
    id INT IDENTITY(1,1) PRIMARY KEY,
    receivedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    jsonRpcId NVARCHAR(100),
    filter NVARCHAR(200) NULL,
    payload NVARCHAR(MAX) NOT NULL,
    source NVARCHAR(100) NULL
);
GO

IF OBJECT_ID('dbo.usp_InitDatabase', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_InitDatabase;
GO

CREATE PROCEDURE dbo.usp_InitDatabase
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        DELETE FROM dbo.TimeLog;
        DELETE FROM dbo.[User];
        DELETE FROM dbo.Project;
        --DELETE FROM dbo.ChronoLog;

        IF OBJECT_ID('dbo.TimeLog','U') IS NOT NULL
            DBCC CHECKIDENT('dbo.TimeLog', RESEED, 0);
        IF OBJECT_ID('dbo.[User]','U') IS NOT NULL
            DBCC CHECKIDENT('dbo.[User]', RESEED, 0);
        IF OBJECT_ID('dbo.Project','U') IS NOT NULL
            DBCC CHECKIDENT('dbo.Project', RESEED, 0);

        INSERT INTO dbo.Project ([name]) VALUES ('My own'), ('Free Time'), ('Work');

        DECLARE @FirstNames TABLE (Name NVARCHAR(100));
        INSERT INTO @FirstNames (Name) VALUES
        ('John'),('Gringo'),('Mark'),('Lisa'),('Maria'),('Sonya'),('Philip'),('Jose'),('Lorenzo'),('George'),('Justin');

        DECLARE @LastNames TABLE (Name NVARCHAR(100));
        INSERT INTO @LastNames (Name) VALUES
        ('Johnson'),('Lamas'),('Jackson'),('Brown'),('Mason'),('Rodriguez'),('Roberts'),('Thomas'),('Rose'),('McDonalds');

        DECLARE @Domains TABLE (Domain NVARCHAR(100));
        INSERT INTO @Domains (Domain) VALUES
        ('hotmail.com'), ('gmail.com'), ('live.com');

        DECLARE @i INT = 1;
        WHILE @i <= 100
        BEGIN
            DECLARE @fn NVARCHAR(100) = (SELECT TOP 1 Name FROM @FirstNames ORDER BY NEWID());
            DECLARE @ln NVARCHAR(100) = (SELECT TOP 1 Name FROM @LastNames ORDER BY NEWID());
            DECLARE @domain NVARCHAR(100) = (SELECT TOP 1 Domain FROM @Domains ORDER BY NEWID());

            DECLARE @email NVARCHAR(256) = LOWER(
                REPLACE(@fn, ' ', '') + N'.' + REPLACE(@ln, ' ', '') + N'@' + @domain
            );

            IF NOT EXISTS (SELECT 1 FROM dbo.[User] WHERE Email = @email)
            BEGIN
                INSERT INTO dbo.[User] (FirstName, LastName, Email)
                VALUES (@fn, @ln, @email);
                SET @i = @i + 1;
            END
        END

        DECLARE cur_users CURSOR LOCAL FAST_FORWARD FOR
            SELECT id FROM dbo.[User];

        OPEN cur_users;
        DECLARE @uid INT;

        WHILE 1 = 1
        BEGIN
            FETCH NEXT FROM cur_users INTO @uid;
            IF @@FETCH_STATUS <> 0 BREAK;

            -- 1..20
            DECLARE @count INT = 1 + (ABS(CHECKSUM(NEWID())) % 20); -- 1..20

            DECLARE @j INT = 1;
            WHILE @j <= @count
            BEGIN
                DECLARE @projId INT = (SELECT TOP 1 id FROM dbo.Project ORDER BY NEWID());

                -- hours: 0.25 .. 8.00
                DECLARE @hours DECIMAL(4,2) = CAST(ROUND((RAND(CHECKSUM(NEWID())) * 7.75) + 0.25, 2) AS DECIMAL(4,2));

                -- last 30 days
                DECLARE @date DATE = DATEADD(DAY, -ABS(CHECKSUM(NEWID())) % 30, GETDATE());

                DECLARE @currentTotal DECIMAL(4,2) = ISNULL((
                    SELECT SUM([hours]) FROM dbo.TimeLog WHERE [userId] = @uid AND [workDate] = @date
                ), 0);

                IF @currentTotal + @hours <= 8.0
                BEGIN
                    INSERT INTO dbo.TimeLog (userId, projectId, workDate, [hours])
                    VALUES (@uid, @projId, @date, @hours);
                    SET @j = @j + 1;
                END
            END
        END

        CLOSE cur_users;
        DEALLOCATE cur_users;

        COMMIT TRANSACTION;
        PRINT 'Database initialized successfully.';
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR('Error in usp_InitDatabase: %s', 16, 1, @ErrMsg);
    END CATCH;
END
GO

EXEC dbo.usp_InitDatabase;
