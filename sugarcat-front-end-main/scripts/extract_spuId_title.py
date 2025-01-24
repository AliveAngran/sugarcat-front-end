import pandas as pd
import json

def extract_spuId_title_from_excel(file_path, output_path):
    # 读取Excel文件
    df = pd.read_excel(file_path, usecols="A,B", dtype=str)
    
    # 去除A列为空的行
    df.dropna(subset=['A'], inplace=True)
    
    # 将数据转换为列表的列表格式
    results = df.values.tolist()
    
    # 将结果写入到一个新的JSON文件中
    with open(output_path, 'w', encoding='utf-8') as outfile:
        json.dump(results, outfile, ensure_ascii=False, indent=4)

# 使用文件的实际路径
extract_spuId_title_from_excel(
    '/Users/arz/Downloads/PanDownload/微信小程序开发/小程序管理前端/sugarcat-front-end/scripts/sto.xls',
    '/Users/arz/Downloads/PanDownload/微信小程序开发/小程序管理前端/sugarcat-front-end/scripts/extracted_spuId_title.json'
)