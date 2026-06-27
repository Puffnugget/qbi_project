library(readxl)

rna <- read_excel("~/Desktop/qbi_hackathon/raw_data/rna_seq.xls", skip = 10)
methylation <- read_excel("~/Desktop/qbi_hackathon/raw_data/methylation.xls", skip = 10)
proteomics <- read_excel("~/Desktop/qbi_hackathon/raw_data/proteomics.xls", skip = 10)
histone <- read_excel("~/Desktop/qbi_hackathon/raw_data/histone.xlsx", skip = 8)
drug <- read_excel("~/Desktop/qbi_hackathon/raw_data/drug_activity.xlsx", skip = 8)



