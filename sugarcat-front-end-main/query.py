import requests
from urllib.parse import quote
import json
from bs4 import BeautifulSoup
import random
import time
import pandas as pd
from typing import List, Dict

def generate_timestamp():
    """生成随机timestamp"""
    return str(random.random())

def parse_table_data(html_content: str) -> List[Dict]:
    """解析HTML表格数据"""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # 查找所有表格
    tables = soup.find_all('table')
    print(f"\n找到 {len(tables)} 个表格")
    
    # 尝试多种方式查找目标表格
    table = None
    
    # 1. 通过class查找
    table = soup.find('table', {'class': 'GridView'})
    if table:
        print("通过GridView class找到表格")
    
    # 2. 如果没找到，尝试其他常见class
    if not table:
        table = soup.find('table', {'class': ['grid', 'datatable', 'list-table']})
        if table:
            print("通过其他class找到表格")
    
    # 3. 如果还没找到，查找第一个包含th的表格
    if not table:
        for t in tables:
            if t.find('th'):
                table = t
                print("通过th标签找到表格")
                break
    
    if not table:
        print("未找到任何符合条件的表格")
        return []
    
    # 获取表头
    headers = ['仓库名称', '商品名称', '条码', '商品编号', '规格型号', '生产日期', 
              '昨日库存', '出库数量', '入库数量', '调整数量', '冻结库存数量', '今日库存']
    print(f"\n找到表头:", headers)
    
    # 获取数据行
    rows = []
    data_rows = table.find_all('tr')[1:]  # 跳过表头行
    print(f"\n找到 {len(data_rows)} 行数据")
    
    def clean_cell_text(text: str) -> str:
        """清理单元格文本"""
        if not text:
            return ''
        # 转换unicode编码
        try:
            text = text.encode().decode('unicode-escape')
        except UnicodeDecodeError:
            pass
        # 清理空白字符
        text = ' '.join(text.split())
        # 去除末尾的逗号
        text = text.rstrip(',')
        return text.strip()
    
    # 处理数据行
    for row in data_rows:
        cells = row.find_all(['td'])
        if cells and len(cells) > 1:
            row_data = {}
            for i, cell in enumerate(cells):
                if i < len(headers):
                    value = clean_cell_text(cell.get_text(strip=True))
                    row_data[headers[i]] = value
            if any(row_data.values()):  # 只添加非空行
                rows.append(row_data)
    
    print(f"成功解析 {len(rows)} 行有效数据")
    if rows:
        print("\n示例数据:")
        print(json.dumps(rows[0], ensure_ascii=False, indent=2))
    
    return rows

def clean_text(text: str) -> str:
    """清理文本,将unicode转为中文,去除多余空白"""
    if not text:
        return ''
    # 转换unicode
    text = text.encode().decode('unicode-escape')
    # 清理空白字符
    text = ' '.join(text.split())
    return text.strip()

def generate_html_report(rows: List[Dict], output_file: str = 'inventory_report.html') -> None:
    """生成HTML格式的库存报告"""
    # HTML模板
    html_template = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>库存查询报告</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
            .report-container {{ padding: 20px; }}
            .report-table {{ margin-top: 20px; }}
            .table-header {{ background-color: #f8f9fa; }}
        </style>
    </head>
    <body>
        <div class="container report-container">
            <h2 class="mb-4">库存查询报告</h2>
            <table class="table table-bordered table-hover report-table">
                <thead>
                    <tr class="table-header">
                        <th>仓库名称</th>
                        <th>商品名称</th>
                        <th>条码</th>
                        <th>商品编号</th>
                        <th>规格型号</th>
                        <th>生产日期</th>
                        <th>昨日库存</th>
                        <th>今日库存</th>
                        <th>出库数量</th>
                        <th>入库数量</th>
                        <th>调整数量</th>
                        <th>冻结库存</th>
                    </tr>
                </thead>
                <tbody>
                    {table_rows}
                </tbody>
            </table>
        </div>
    </body>
    </html>
    """
    
    # 生成表格行
    table_rows = []
    for row in rows:
        table_rows.append(f"""
            <tr>
                <td>{row['仓库名称']}</td>
                <td>{row['商品名称']}</td>
                <td>{row['条码']}</td>
                <td>{row['商品编号']}</td>
                <td>{row['规格型号']}</td>
                <td>{row['生产日期']}</td>
                <td>{row['昨日库存']}</td>
                <td>{row['今日库存']}</td>
                <td>{row['出库数量']}</td>
                <td>{row['入库数量']}</td>
                <td>{row['调整数量']}</td>
                <td>{row['冻结库存数量']}</td>
            </tr>
        """)
    
    # 生成完整HTML
    html_content = html_template.format(table_rows='\n'.join(table_rows))
    
    # 写入文件
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f"\n报告已生成: {output_file}")

def make_request():
    # 请求URL
    url = 'https://lxy.liankai.com/kuCunManage/InventoryCheck.aspx'
    
    # 生成timestamp
    timestamp = generate_timestamp()
    
    # 设置headers
    headers = {
        'authority': 'lxy.liankai.com',
        'accept': '*/*',
        'accept-encoding': 'gzip, deflate, br, zstd',
        'accept-language': 'en,zh;q=0.9',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'origin': 'https://lxy.liankai.com',
        'referer': f'https://lxy.liankai.com/kuCunManage/InventoryCheck.aspx?timestamp={timestamp}',
        'sec-ch-ua': '"Microsoft Edge";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0'
    }
    
    # 设置cookies
    cookies = {
        'loginInfo': 'Name=%e5%91%a8%e6%98%82%e7%84%b6',
        'pagesize': 'JYLCZBSearchPageSize=10',
        'ASP.NET_SessionId': 'bdtsh4hcgjvmveiil4ovstil',
        '.FenXiao': '9EB148109B64BE08AF6F271BED0E00FA6D957FE88F41F8BD5EDE6523B649158A73200809FA5F321C845EEB6AF139CE3D19405CAA635F2C1ACD8F52B2C920C51B1FE701EAE906B0D846D22568A97390511A34737390985247F20D548BF181AF7E87848C43838FDC3AC7A8E781A076EA050D6336D4A43946FDA1F7C871291E7C1D'
    }
    
    try:
        # 创建session对象
        session = requests.Session()
        
        # 先发送GET请求获取初始页面
        init_response = session.get(
            url,
            headers={k: v for k, v in headers.items() if k not in ['content-type']},
            cookies=cookies,
            verify=False
        )
        
        # 解析页面获取viewstate
        soup = BeautifulSoup(init_response.text, 'html.parser')
        viewstate = soup.find('input', {'name': '__VIEWSTATE'})['value']
        
        # 设置POST数据
        data = {
            'Anthem_UpdatePage': 'true',
            '__EVENTTARGET': 'btnSearch',
            '__EVENTARGUMENT': '',
            '__LASTFOCUS': '',
            '__VIEWSTATE': viewstate,
            '__VIEWSTATEGENERATOR': '473175CD',
            '__VIEWSTATEENCRYPTED': '',
            'txtBeginDate': '2024-11-29',
            'txtEndDate': '2024-11-29',
            'dropKYKC': '-1',
            'txtSearch': '6911316400306',
            'chkDKW': 'on',
            'cblStockType$0': 'on',
            'cblStockType$1': 'on',
            'cblStockType$2': 'on',
            'MyPager1$hfChangePageSize': '',
            'hfYhzCdid': '09679AE7-A3A1-4E08-9DC1-8A9A96EF6438',
            'hfCKID': '',
            'hdfcpid': ''
        }
        
        # 设置查询参数
        params = {
            'timestamp': timestamp,
            'Anthem_CallBack': 'true'
        }
        
        # 发送POST请求
        response = session.post(
            url,
            params=params,
            headers=headers,
            cookies=cookies,
            data=data,
            verify=False
        )
        
        # 检查响应状态
        response.raise_for_status()
        
        # 打印响应信息
        print(f"\n=== 响应信息 ===")
        print(f"状态码: {response.status_code}")
        print(f"Content-Type: {response.headers.get('content-type', 'unknown')}")
        print(f"响应长度: {len(response.text)} 字符")
        
        # 解析响应数据
        rows = parse_table_data(response.text)
        
        # 生成HTML报告
        if rows:
            print("\n=== 生成报告 ===")
            generate_html_report(rows)
        else:
            print("\n=== 警告 ===")
            print("未能解析到任何数据，请检查响应内容和解析逻辑")
        
        return response
        
    except requests.exceptions.RequestException as e:
        print(f'\n=== 错误信息 ===')
        print(f'请求发生错误: {str(e)}')
        if hasattr(e, 'response'):
            print(f'错误响应状态码: {e.response.status_code}')
            print(f'错误响应内容: {e.response.text[:500]}...')  # 只打印前500个字符
        return None

def make_custom_request():
    # 请求URL
    url = 'https://lxy.liankai.com/Manage/CustomManage.aspx'

    # 生成timestamp
    timestamp = generate_timestamp()

    # 设置headers
    headers = {
        'authority': 'lxy.liankai.com',
        'accept': '*/*',
        'accept-encoding': 'gzip, deflate, br, zstd',
        'accept-language': 'en,zh;q=0.9',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'origin': 'https://lxy.liankai.com',
        'referer': f'https://lxy.liankai.com/Manage/CustomManage.aspx?timestamp={timestamp}',
        'sec-ch-ua': '"Microsoft Edge";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0'
    }

    # 设置cookies
    cookies = {
        'loginInfo': 'Name=%e5%91%a8%e6%98%82%e7%84%b6',
        'pagesize': 'JYLCZBSearchPageSize=10',
        'ASP.NET_SessionId': 'bg2rir3jvlpfam4f5hmx4xmh',
        '.FenXiao': '6F6241305659F3BB75B11B6D4B7461E287C01CA03D5BE52AE44AD5855A328B9ACE111CEC15B082ACE6702D45B7EB31A17A52D4CDAA5595E5C8197BEF6022A0AA2AD3710298CBDB4AF3ADFF535C5673B0A2EC8C42A6365FBD39DA7B57E1F9A09B56AAC9EAA2406D40533F46C803AC4FA1A705B4E8CCFEFD96180BAEAB1CC3EF62'
    }

    try:
        # 创建session对象
        session = requests.Session()

        # 先发送GET请求获取初始页面
        init_response = session.get(
            url,
            headers={k: v for k, v in headers.items() if k not in ['content-type']},
            cookies=cookies,
            verify=False
        )

        # 解析页面获取viewstate
        soup = BeautifulSoup(init_response.text, 'html.parser')
        viewstate = soup.find('input', {'name': '__VIEWSTATE'})['value']

        # 设置POST数据
        data = {
            'Anthem_UpdatePage': 'true',
            '__EVENTTARGET': 'btnSearch',
            '__EVENTARGUMENT': '',
            '__LASTFOCUS': '',
            '__VIEWSTATE': viewstate,
            '__VIEWSTATEGENERATOR': '0BFF6C66',
            'txtTargetGroup': '',
            'txtAqqkje': '',
            'txtAqqkts': '',
            'rblSKFS': '401',
            'hdfControl': '',
            'hfTwoLevel_FirstId': '',
            'hfTwoLevel_SecondId': '',
            'hfTwoLevelId': '',
            'txtBeginDate': '',
            'txtEndDate': '',
            'txtSearch': '江',
            'txtID': '',
            'txtKHLBID': '',
            'txtQtBm': '',
            'txtSelectedData': '',
            'txtJLKHBM': '',
            'txtMode': '1',
            'weyio1': '1',
            'hdfCusotmerTypeId': '',
            'hdfCustomerTypeNode': '',
            'hdfCustomerId': '',
            'txtKHBH': '',
            'hdfIsEdit': '0',
            'leftPartAlowEdit': 'true',
            'hdfNEWYWYID': '',
            'txtYWYMC': '',
            'hfKHID': '',
            'hfKHMC': '',
            'hfDeleteID': '',
            'hfDbType': '',
            'hfKhType': '0',
            'hfYhzCdid': '82312e34-a149-46b5-abd8-a94666354aec',
            'hfSFKTLKSC': 'false',
            'hfQYPZT': 'false'
        }

        # 设置查询参数
        params = {
            'timestamp': timestamp,
            'Anthem_CallBack': 'true'
        }

        # 发送POST请求
        response = session.post(
            url,
            params=params,
            headers=headers,
            cookies=cookies,
            data=data,
            verify=False
        )

        # 检查响应状态
        response.raise_for_status()

        # 打印响应信息
        print(f"\n=== 响应信息 ===")
        print(f"状态码: {response.status_code}")
        print(f"Content-Type: {response.headers.get('content-type', 'unknown')}")
        print(f"响应长度: {len(response.text)} 字符")

        # 解析响应数据
        rows = parse_table_data(response.text)

        # 生成HTML报告
        if rows:
            print("\n=== 生成报告 ===")
            generate_html_report(rows)
        else:
            print("\n=== 警告 ===")
            print("未能解析到任何数据，请检查响应内容和解析逻辑")

        return response

    except requests.exceptions.RequestException as e:
        print(f'\n=== 错误信息 ===')
        print(f'请求发生错误: {str(e)}')
        if hasattr(e, 'response'):
            print(f'错误响应状态码: {e.response.status_code}')
            print(f'错误响应内容: {e.response.text[:500]}...')  # 只打印前500个字符
        return None

def make_jqgrid_request():
    # 请求URL
    url = 'https://lxy.liankai.com/AsynServer/JqGridServer.ashx'

    # 设置headers
    headers = {
        'accept': 'application/json, text/javascript, */*; q=0.01',
        'accept-language': 'en,zh;q=0.9',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'cookie': 'loginInfo=Name=%e5%91%a8%e6%98%82%e7%84%b6; pagesize=JYLCZBSearchPageSize=10; ASP.NET_SessionId=bg2rir3jvlpfam4f5hmx4xmh; .FenXiao=6F6241305659F3BB75B11B6D4B7461E287C01CA03D5BE52AE44AD5855A328B9ACE111CEC15B082ACE6702D45B7EB31A17A52D4CDAA5595E5C8197BEF6022A0AA2AD3710298CBDB4AF3ADFF535C5673B0A2EC8C42A6365FBD39DA7B57E1F9A09B56AAC9EAA2406D40533F46C803AC4FA1A705B4E8CCFEFD96180BAEAB1CC3EF62',
        'origin': 'https://lxy.liankai.com',
        'priority': 'u=1, i',
        'referer': 'https://lxy.liankai.com/Manage/CustomManage.aspx?timestamp=0.2252656478760946',
        'sec-ch-ua': '"Microsoft Edge";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
        'x-requested-with': 'XMLHttpRequest'
    }

    # 设置POST数据
    data = {
        'op': 'CustomManageNew',
        'search': '江',
        'beginDate': '1900-01-01',
        'endDate': '2100-01-01',
        'sfjljxs': 'false',
        'dbType': '',
        'khType': '0',
        'qtbm': '',
        'sfzf': 'false',
        '_search': 'false',
        'nd': '1733993079209',
        'rows': '200',
        'page': '1',
        'sidx': 'khmc',
        'sord': 'asc'
    }

    try:
        # 创建session对象
        session = requests.Session()

        # 发送POST请求
        response = session.post(
            url,
            headers=headers,
            data=data,
            verify=False
        )

        # 检查响应状态
        response.raise_for_status()

        # 打印响应信息
        print(f"\n=== 响应信息 ===")
        print(f"状态码: {response.status_code}")
        print(f"Content-Type: {response.headers.get('content-type', 'unknown')}")
        print(f"响应长度: {len(response.text)} 字符")

        # 解析JSON响应数据
        json_data = response.json()
        print(json.dumps(json_data, ensure_ascii=False, indent=2))

        return json_data

    except requests.exceptions.RequestException as e:
        print(f'\n=== 错误信息 ===')
        print(f'请求发生错误: {str(e)}')
        if hasattr(e, 'response'):
            print(f'错误响应状态码: {e.response.status_code}')
            print(f'错误响应内容: {e.response.text[:500]}...')  # 只打印前500个字符
        return None

if __name__ == '__main__':
    # 禁用SSL警告
    import urllib3
    urllib3.disable_warnings()
    
    # 执行请求
    result = make_request()
