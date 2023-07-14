import { IFieldMeta as FieldMeta, IWidgetField, IWidgetTable, TableMeta, bitable } from "@base-open/web-api";
import { useEffect, useState, useRef } from "react";
import { Form, Toast, Spin, Tooltip, Button, Col, Row } from "@douyinfe/semi-ui";
import { IconHelpCircle, IconClose } from '@douyinfe/semi-icons';
import DelTable from "./table";
import axios from "axios";



/** 如f-12345678 */
function getLast8Digits() {
  let timestamp = new Date().getTime();
  // 获取时间戳的字符串形式
  const timestampString = timestamp.toString();
  // 获取时间戳字符串的最后6位，如果不足6位则返回整个字符串
  const last8Digits = timestampString.slice(-8);
  return 'f-' + last8Digits;
}

/** 找出来需要被删除的那些，key为字段值的json格式 */
export interface ToDelete {
  /** 找出来需要被删除的那些，key为字段值的json格式  */
  [p: string]: string[]
}
/** 找出来需要被保留的那个，key为字段值的json格式 */
export interface Existing {
  /** 找出来需要被保留的那个,key为字段值的json格式  */
  [p: string]: string
}

/** 当前table级的信息 */
export interface TableInfo {
  /** 当前所选的table,默认为打开插件时的table */
  table: IWidgetTable,
  /** 当前所选table的元信息 */
  tableMeta: TableMeta
  /** 所有的table元信息 */
  tableMetaList: TableMeta[],
  /** 所有table的实例 */
  tableList: IWidgetTable[]
}

/** 当前table所有field信息 */
export interface FieldInfo {
  /**当前所选field的实例 */
  field: IWidgetField | undefined
  /** 当前所选field的元信息 */
  fieldMeta: FieldMeta | undefined
  /** tableInfo.table的所有field实例 */
  fieldList: IWidgetField[],
  /** tableInfo.table的所有field元信息 */
  fieldMetaList: FieldMeta[]
}

/** 表单所选的字段相关信息 */
export interface FormFields {
  /** 用来排序的那个field的相关信息 */
  sortFieldValueList: {
    field: IWidgetField,
    fieldMeta: FieldMeta,
    valueList: any[]
  },
  /** 标识字段值那些列的相关信息 */
  identifyingFieldsValueList: {
    field: IWidgetField,
    fieldMeta: FieldMeta,
    valueList: any[]
  }[]
}

export default function index() {
  const [loading, setLoading] = useState(false);
  const [toDelete, setToDelete] = useState<ToDelete>()
  const [existing, setExisting] = useState<Existing>()

  // 传给table的props，
  const [fieldsValueLists, setFieldsValueLists] = useState<FormFields>()
  const [, f] = useState<any>()

  const updateCom = () => f({})
  //用来数filed的，控制新增/删除标识字段
  const count = useRef<Set<string>>(new Set([getLast8Digits()]))

  /** toDelete中的所有recordId */
  const toDeleteRecordIds = useRef<string[]>([])

  const [selection, setSelection] = useState();
  const [tableInfo, setTableInfo] = useState<TableInfo>();
  const [fieldInfo, setFieldInfo] = useState<FieldInfo>()

  const formApi = useRef<any>()

  useEffect(() => {
    async function init() {
      const selection = await bitable.base.getSelection();

      //toreport: 这个在选行的时候不起作用
      bitable.base.onSelectionChange((event) => {
        console.log('selectionChange', event, selection);
      })

      if (selection.tableId) {
        const [tableRes, tableMetaListRes, tableListRes] = await Promise.all([
          bitable.base.getTableById(selection.tableId),
          bitable.base.getTableMetaList(),
          bitable.base.getTableList()
        ]);
        setTableInfo({
          table: tableRes,
          tableMeta: tableMetaListRes.find(({ id }) => tableRes.id === id)!,
          tableMetaList: tableMetaListRes,
          tableList: tableListRes
        });
        //设置table选项为自身
        formApi.current.setValues({ 'table_id': tableRes.id, 'prompt_id': formApi.current.getValues('prompt_id').prompt_id, 'openai_key': formApi.current.getValues('openai_key').openai_key })

        const fieldMetaList = await tableRes.getFieldMetaList();
        const fieldList = await tableRes.getFieldList();
        setFieldInfo({
          fieldList,
          fieldMetaList,
          field: undefined,
          fieldMeta: undefined
        })
      }
    }
    init();
  }, [])

  const OpenAI = (key) => {
    const apiKey = key;//process.env.OPENAI_API_KEY;
    const client = axios.create({
      headers: {
        "Authorization": "Bearer " + apiKey,
      },
    });

    return function(prompt, callback) {
      const params = {
        "prompt": prompt,
        "max_tokens": 999,
      };

      const response = client.post("https://api.openai.com/v1/engines/text-davinci-003/completions", params);
      response.then((response) => {
        if (response.status === 200) {
          callback(response.data.choices[0].text.trim());
        } else {
          callback(false);
        }
      })

    }
  }

  const generate = async () => {

    let { openai_key, table_id, raw_field_id, prompt_id, target_field_id } = formApi.current.getValues();

    if (!(openai_key && table_id && raw_field_id && prompt_id && target_field_id)) {
      Toast.error('Please enter all required fields')
      return;
    }
    setLoading(true);

    //toreport: 这里为啥要特意做一个0ms异步
    //setTimeout(async () => {
    // let { table_id, raw_field_id, prompt_id, target_field_id} = formApi.current.getValues();

    const raw_field = fieldInfo?.fieldList.find(({ id }) => id === raw_field_id)!
    const target_field = fieldInfo?.fieldList.find(({ id }) => id === target_field_id)!


    let raw_input = await raw_field.getFieldValueList();

    let pack_prompt = raw_input.map((obj) => prompt_id.replace(/\[content\]/g, obj.value[0]?.text));

    let OpenAIRequester = OpenAI(openai_key);

    //request openai here

    //write back
    (async () => {
      raw_input.map(async (obj, index) => {
        //console.log('obj', obj);
        //console.log('index', index);
        //console.log('op', target_field, target_field_id, obj.record_id, pack_prompt[index]);

        //let _cellValue = await tableInfo.table.getCellValue(target_field_id,obj.record_id);
        //_cellValue[0].text = pack_prompt[index];
        let response = OpenAIRequester(pack_prompt[index], async function(response) {
          response = await response;
          let res = await (tableInfo.table.setCellValue(target_field_id, obj.record_id, [{ 'type': 'text', 'text': response }]));
          if (index == pack_prompt.length - 1) {
            setLoading(false);
          }
        });
      });
    })();


    //}, 0);
  }


  /** 选择table的时候更新tableInfo和fieldInfo */
  const onSelectTable = async (t: any) => {
    if (tableInfo) {
      // 单选
      setLoading(true)
      const { tableList, tableMetaList } = tableInfo
      const choosedTable = tableList.find(({ id }) => id === t)!;
      const choosedTableMeta = tableMetaList.find(({ id }) => id === t)!;
      setTableInfo({
        ...tableInfo,
        table: choosedTable,
        tableMeta: choosedTableMeta
      });
      const [fieldMetaList, fieldList] = await Promise.all([choosedTable.getFieldMetaList(), choosedTable.getFieldList()])
      setFieldInfo({
        fieldList,
        fieldMetaList,
        field: undefined,
        fieldMeta: undefined
      });
      setLoading(false)
      formApi.current.setValues({
        table_id: choosedTable.id,
        prompt_id: formApi.current.getValues('prompt_id').prompt_id,
        openai_key: formApi.current.getValues('openai_key').openai_key,
      })
    }
  }

  const onSelectField = (f: any) => {
    if (!tableInfo?.table) {
      Toast.error('请先选择table');
      return;
    } else {
      const { fieldMetaList, fieldList } = fieldInfo!
      const choosedField = fieldList.find(({ id }) => f === id)!
      const choosedFieldMeta = fieldMetaList.find(({ id }) => f === id)!;
      setFieldInfo({
        ...fieldInfo,
        field: choosedField,
        fieldMeta: choosedFieldMeta
      } as any)
    }
  }

  const onDel = async (del: any) => {
    setLoading(true);
    await del();
    setLoading(false);
    setToDelete({});
    setExisting({});
  }

  const fieldMetas = (Array.isArray(fieldInfo?.fieldMetaList) &&
    // 等待切换table的时候，拿到正确的fieldList
    fieldInfo?.fieldList[0]?.tableId === tableInfo?.table.id &&
    fieldInfo?.fieldMetaList) || []

  return <div>
    <Spin size="large" spinning={loading}>
      <div>
        <p>
          Select one specific field as the raw entry, and enter prompt here, you will get what AI and LLM completes for you in your designated field.
        </p>
        <br />
      </div>
      <Form
        labelPosition='left'
        labelAlign='right'
        getFormApi={(e: any) => formApi.current = e}>
        <Form.Input label='OpenAI Key' field='openai_key'></Form.Input>
        <Form.Select style={{ width: '100%' }} onChange={onSelectTable} label='Table' field="table_id">
          {
            Array.isArray(tableInfo?.tableMetaList) && tableInfo?.tableMetaList.map(({ id, name }) => <Form.Select.Option key={id} value={id}>{name}</Form.Select.Option>)
          }
        </Form.Select>
        <Form.Select style={{ width: '100%' }} onChange={onSelectField} label='Raw entry' field="raw_field_id">
          {
            fieldMetas.map(({ id, name }) => <Form.Select.Option key={id} value={id}>{name}</Form.Select.Option>)
          }
        </Form.Select>
        <p>Using [content] to stand for the raw input within the prompt, otherwise it will be appended to the end of the prompt</p>
        <Form.TextArea autosize label="Prompt" field="prompt_id" initValue="帮我写一首关于 [content] 的七言律诗">
        </Form.TextArea>

        <Form.Select style={{ width: '100%' }} label='TargetField' field="target_field_id">
          {
            fieldMetas.map(({ id, name }) => <Form.Select.Option key={id} value={id}>{name}</Form.Select.Option>)
          }
        </Form.Select>


      </Form>

      <Row>
        <Col span={18}>
          <Button onClick={generate}> Generate Content </Button>
        </Col>
      </Row>
      {existing && toDelete && fieldInfo?.fieldMetaList && fieldsValueLists && tableInfo && toDeleteRecordIds.current.length > 0 && <DelTable
        getOnDel={onDel}
        key={toDeleteRecordIds.current.join('')}
        defaultToDelRecords={toDeleteRecordIds.current}
        existing={existing}
        toDelete={toDelete}
        tableFieldMetaList={fieldInfo?.fieldMetaList}
        formFields={fieldsValueLists}
        fieldInfo={fieldInfo}
        tableInfo={tableInfo}
      ></DelTable>}
    </Spin>
  </div>
}
